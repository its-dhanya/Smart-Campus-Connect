importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBDeq6g3g7NYyCTo1AFUmNQ2xYsJOPYYwE",
  authDomain: "smartcampusconnect-bf148.firebaseapp.com",
  projectId: "smartcampusconnect-bf148",
  storageBucket: "smartcampusconnect-bf148.firebasestorage.app",
  messagingSenderId: "777527724322",
  appId: "1:777527724322:web:43ceb34e12f4eaf36ffd7b"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background FCM message:', payload);
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'Smart Campus', {
    body: body || 'You have a new notification',
    icon: '/vite.svg',
    badge: '/vite.svg',
    data: payload.data,
  });
});