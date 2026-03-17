const { getMessaging } = require('../config/fireBaseAdmin');

/**
 * Send a multicast FCM notification to multiple tokens.
 * Returns { successCount, failureCount, failedTokens }
 */
const sendMulticast = async ({ tokens, title, body, data = {} }) => {
  if (!tokens || tokens.length === 0) {
    return { successCount: 0, failureCount: 0, failedTokens: [] };
  }

  const messaging = getMessaging();

  // FCM sendEachForMulticast supports up to 500 tokens per call
  const CHUNK_SIZE = 500;
  let successCount = 0;
  let failureCount = 0;
  const failedTokens = [];

  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE);

    const message = {
      tokens: chunk,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: { sound: 'default' },
      },
      apns: {
        payload: { aps: { sound: 'default' } },
      },
    };

    const response = await messaging.sendEachForMulticast(message);
    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        failedTokens.push({
          token: chunk[idx],
          error: resp.error?.message || 'unknown',
        });
      }
    });
  }

  return { successCount, failureCount, failedTokens };
};

/**
 * Send a single FCM notification to one token.
 * Returns { success, error }
 */
const sendSingle = async ({ token, title, body, data = {} }) => {
  if (!token) return { success: false, error: 'No FCM token provided' };

  const messaging = getMessaging();

  const message = {
    token,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: {
      priority: 'high',
      notification: { sound: 'default' },
    },
    apns: {
      payload: { aps: { sound: 'default' } },
    },
  };

  try {
    await messaging.send(message);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

module.exports = { sendMulticast, sendSingle };