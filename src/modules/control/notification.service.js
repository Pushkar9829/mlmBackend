import { Notification } from "./notification.model.js";

export async function notify(userId, title, body) {
  if (!userId) return null;
  return Notification.create({ user: userId, title, body });
}

export const notificationService = {
  async list(actor) {
    const rows = await Notification.find({ user: actor.id }).sort({ createdAt: -1 }).limit(50);
    return rows.map((row) => ({
      id: String(row._id),
      title: row.title,
      body: row.body,
      read: row.read,
      createdAt: row.createdAt,
    }));
  },
  async markRead(actor, id) {
    const row = await Notification.findOne({ _id: id, user: actor.id });
    if (!row) return null;
    row.read = true;
    await row.save();
    return { id: String(row._id), read: true };
  },
  async update(actor, id, { title, body }) {
    const row = await Notification.findOne({ _id: id, user: actor.id });
    if (!row) return null;
    row.title = title;
    row.body = body;
    await row.save();
    return { id: String(row._id), title: row.title, body: row.body, read: row.read };
  },
  async remove(actor, id) {
    const row = await Notification.findOneAndDelete({ _id: id, user: actor.id });
    if (!row) return null;
    return { id: String(id) };
  },
};
