const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');

let firebaseApp;

const initFirebase = () => {
  if (firebaseApp) return firebaseApp;

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    console.error('❌ Firebase Admin initialization failed:', err.message);
    throw err;
  }

  return firebaseApp;
};

const getMessaging = () => {
  initFirebase();
  return admin.messaging();
};

module.exports = { initFirebase, getMessaging };