import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// ─── STEP 1: Paste your Firebase config here ───────────────
// Firebase Console → Project Settings → Your apps → Web app → SDK setup
const firebaseConfig = {
    apiKey: "AIzaSyBDeq6g3g7NYyCTo1AFUmNQ2xYsJOPYYwE",
    authDomain: "smartcampusconnect-bf148.firebaseapp.com",
    projectId: "smartcampusconnect-bf148",
    storageBucket: "smartcampusconnect-bf148.firebasestorage.app",
    messagingSenderId: "777527724322",
    appId: "1:777527724322:web:43ceb34e12f4eaf36ffd7b"
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
      vapidKey: 'BIU6-GJUmjjYIvS5jPUZqVGI_pHEn_01X0_3gBDdfXz1FjIy30Lvbd7oicjAdEddhrvUbS38js84EhuzD7rZLrQ',
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