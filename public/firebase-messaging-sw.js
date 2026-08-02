importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDtXtoaK4FCt5tLLLdBxWMohJPDdygczuw",
  authDomain: "notion-free.firebaseapp.com",
  projectId: "notion-free",
  storageBucket: "notion-free.firebasestorage.app",
  messagingSenderId: "473557101524",
  appId: "1:473557101524:web:9afd5964569b9530248441"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();
  
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification?.title || 'Habit Reminder';
    const notificationOptions = {
      body: payload.notification?.body || 'Time to complete your habits!',
      icon: '/favicon.ico'
    };
    
    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch(e) {
  console.log("Service Worker Firebase initialization failed.", e);
}

// Immediate installation & activation
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Add IndexedDB support and message listener for background reminders
function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('RemindersDB', 2);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('reminders')) {
        db.createObjectStore('reminders', { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function saveReminder(reminder) {
  return getDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reminders', 'readwrite');
      const store = tx.objectStore('reminders');
      store.put(reminder);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

function deleteReminder(id) {
  return getDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reminders', 'readwrite');
      const store = tx.objectStore('reminders');
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

function clearAllReminders() {
  return getDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reminders', 'readwrite');
      const store = tx.objectStore('reminders');
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

function getAllReminders() {
  return getDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reminders', 'readonly');
      const store = tx.objectStore('reminders');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  });
}

self.addEventListener('message', (event) => {
  if (!event.data) return;
  
  if (event.data.type === 'SYNC_REMINDERS') {
    const reminders = event.data.reminders || [];
    clearAllReminders()
      .then(() => {
        const promises = reminders.map(r => saveReminder(r));
        return Promise.all(promises);
      })
      .then(() => {
        console.log('[SW] Reminders synchronized:', reminders.length);
      })
      .catch(err => {
        console.error('[SW] Sync reminders failed:', err);
      });
  } else if (event.data.type === 'ADD_FOCUS_TIMER') {
    const timer = event.data.timer;
    saveReminder(timer)
      .then(() => {
        console.log('[SW] Focus timer added:', timer.title);
      })
      .catch(err => {
        console.error('[SW] Focus timer add failed:', err);
      });
  }
});

// Periodic check loop - runs every 5 seconds
setInterval(async () => {
  try {
    const reminders = await getAllReminders();
    const now = new Date();
    const nowHours = now.getHours().toString().padStart(2, '0');
    const nowMinutes = now.getMinutes().toString().padStart(2, '0');
    const nowTime = `${nowHours}:${nowMinutes}`;
    const nowDayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

    for (const reminder of reminders) {
      if (!reminder.active) continue;

      let shouldTrigger = false;

      if (reminder.type === 'timer') {
        const end = new Date(reminder.endTime);
        if (end <= now) {
          shouldTrigger = true;
        }
      } else if (reminder.type === 'daily') {
        if (reminder.time === nowTime && reminder.lastTriggeredDate !== nowDayStr) {
          shouldTrigger = true;
          reminder.lastTriggeredDate = nowDayStr;
          await saveReminder(reminder);
        }
      } else if (reminder.type === 'once') {
        const reminderTime = new Date(reminder.dateTime);
        const timeDiff = now.getTime() - reminderTime.getTime();
        if (reminderTime <= now && timeDiff < 3 * 60 * 1000) {
          shouldTrigger = true;
          reminder.active = false;
          await saveReminder(reminder);
        } else if (timeDiff >= 3 * 60 * 1000) {
          reminder.active = false;
          await saveReminder(reminder);
        }
      }

      if (shouldTrigger) {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          self.registration.showNotification(reminder.title || 'Reminder Alert!', {
            body: reminder.body || 'You have an active reminder.',
            icon: '/favicon.ico',
            tag: reminder.id,
            requireInteraction: true,
            vibrate: [200, 100, 200]
          });
        } else {
          self.registration.showNotification(reminder.title || 'Reminder Alert!', {
            body: reminder.body || 'You have an active reminder.',
            icon: '/favicon.ico',
            tag: reminder.id
          });
        }

        if (reminder.type === 'timer') {
          await deleteReminder(reminder.id);
        }
      }
    }
  } catch (err) {
    console.error('[SW] Error in periodic reminder check:', err);
  }
}, 5000);
