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
