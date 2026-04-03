import { toast } from "sonner"; // 追加

const INVENTORY_URL = import.meta.env.VITE_INVENTORY_WEBHOOK_URL;
const REQUEST_URL = import.meta.env.VITE_REQUEST_WEBHOOK_URL;

const postToDiscord = async (
  type: "inventory" | "request",
  message: string,
  botName: string,
) => {
  try {
    const response = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, message }),
    });

    if (!response.ok) {
      toast.error(`Discord送信エラー: HTTP ${response.status}`);
    }
  } catch (e: any) {
    toast.error(`通信エラー: ${e.message}`);
  }
};

export const sendInventoryNotification = (msg: string) =>
  postToDiscord("inventory", `📦 **【在庫管理Bot】**\n${msg}`, "INVENTORY");

export const sendRequestNotification = (msg: string) =>
  postToDiscord("request", `📝 **【出庫申請Bot】**\n${msg}`, "REQUEST");
