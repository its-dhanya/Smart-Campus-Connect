// public/firebase-messaging-sw.js
// This file MUST be in the /public folder so it's served at the root as /firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Must match your firebaseConfig in src/lib/firebase.js
const firebaseConfig = {
    apiKey: "AIzaSyBDeq6g3g7NYyCTo1AFUmNQ2xYsJOPYYwE",
    authDomain: "smartcampusconnect-bf148.firebaseapp.com",
    projectId: "smartcampusconnect-bf148",
    storageBucket: "smartcampusconnect-bf148.firebasestorage.app",
    messagingSenderId: "777527724322",
    appId: "1:777527724322:web:43ceb34e12f4eaf36ffd7b"
  };

const messaging = firebase.messaging();

// Handle background messages (when app is closed or in background)
messaging.onBackgroundMessage((payload) => {
  console.log('Background FCM message:', payload);

  const { title, body } = payload.notification || {};

  self.registration.showNotification(title || 'Smart Campus', {
    body: body || 'You have a new notification',
    icon: '/vite.svg', // swap with your app icon if you have one
    badge: '/vite.svg',
    data: payload.data,
  });
});