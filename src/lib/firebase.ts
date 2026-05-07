import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAl0IMkehbCaWy8eWMSqqVMRyAIt8cR5WY",
  authDomain: "nova-7258f.firebaseapp.com",
  projectId: "nova-7258f",
  storageBucket: "nova-7258f.firebasestorage.app",
  messagingSenderId: "259373588544",
  appId: "1:259373588544:web:b574c2a82dc5b46aeebfa5"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);
const storage = getStorage(app);

let messaging: any = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      try {
        messaging = getMessaging(app);
      } catch (err) {
        console.error("Messaging not supported", err);
      }
    }
  });
}

export { app, auth, googleProvider, db, messaging, storage };
