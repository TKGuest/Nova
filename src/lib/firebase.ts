import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";
import { getStorage } from "firebase/storage";
import firebaseConfig from "../../firebase-applet-config.json";

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
// CRITICAL: Must use firestoreDatabaseId from firebase-applet-config.json
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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

