import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// ─── STEP 1: Paste your Firebase config here ───────────────
// Firebase Console → Project Settings → Your apps → Web app → SDK setup
const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  };
  
// ───────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const requestFCMToken = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied');
      return null;
    }

    // ─── STEP 2: Paste your VAPID key here ─────────────────
    // Firebase Console → Project Settings → Cloud Messaging
    // → Web Push certificates → Generate key pair → copy Key pair
    const token = await getToken(messaging, {
      vapidKey: '',
    });
    // ───────────────────────────────────────────────────────

    if (token) {
      console.log('FCM Token:', token);
      return token;
    } else {
      console.warn('No FCM token received');
      return null;
    }
  } catch (err) {
    console.error('Error getting FCM token:', err);
    return null;
  }
};

export const onForegroundMessage = (callback) => {
  return onMessage(messaging, (payload) => {
    console.log('Foreground FCM message:', payload);
    callback(payload);
  });
};
