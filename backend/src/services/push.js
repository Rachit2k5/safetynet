import webpush from 'web-push';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export const sendAlert = async (io, db, tripId, alertPayload) => {
  io.to(`trip:${tripId}`).emit('alert:new', alertPayload);

  const trip = db.prepare('SELECT user_id FROM trips WHERE id = ?').get(tripId);
  if (!trip) return;

  const subscriptions = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(trip.user_id);
  
  for (const sub of subscriptions) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth
      }
    };

    try {
      await webpush.sendNotification(pushSub, JSON.stringify(alertPayload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
      } else {
        console.error('Push notification error:', err);
      }
    }
  }
};