// backend/src/services/push.service.js
import webpush from 'web-push';

// .env values runtime pe read karo — module load pe nahi
export const initPush = () => {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
};

export const sendPushNotification = async (subscription, payload) => {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (err) {
    if (err.statusCode === 410) {
      return { expired: true, endpoint: subscription.endpoint };
    }
    console.error('Push send error:', err.message);
  }
};

export const sendPushToAll = async (subscriptions, payload) => {
  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendPushNotification(sub, payload))
  );
  return results;
};