// src/utils/notificationUtils.ts

const INVENTORY_URL = import.meta.env.VITE_INVENTORY_WEBHOOK_URL;
const REQUEST_URL = import.meta.env.VITE_REQUEST_WEBHOOK_URL;

const postToDiscord = async (url: string, message: string) => {
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
  } catch (e) {
    console.error("Discord通知送信失敗:", e);
  }
};

// 在庫の追加・修正・削除用
export const sendInventoryNotification = (msg: string) =>
  postToDiscord(INVENTORY_URL, `📦 **【在庫管理Bot】**\n${msg}`);

// 申請・承認・返却用
export const sendRequestNotification = (msg: string) =>
  postToDiscord(REQUEST_URL, `📝 **【出庫申請Bot】**\n${msg}`);
