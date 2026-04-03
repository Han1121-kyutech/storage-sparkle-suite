import { toast } from "sonner"; // 追加

const INVENTORY_URL = import.meta.env.VITE_INVENTORY_WEBHOOK_URL;
const REQUEST_URL = import.meta.env.VITE_REQUEST_WEBHOOK_URL;

const postToDiscord = async (
  url: string | undefined,
  message: string,
  botName: string,
) => {
  // 1. URLが読み込めているか画面に強制表示して確認
  if (!url) {
    toast.error(
      `❌ ${botName}のURLがundefinedだ。Cloudflareの環境変数がビルド時に注入されていない。`,
    );
    console.error("Missing URL for:", botName);
    return;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });

    // 2. Discord側に弾かれた場合（400エラー等）の検知
    if (!response.ok) {
      toast.error(`Discord送信エラー: HTTP ${response.status}`);
      console.error("Discord Error:", await response.text());
    }
  } catch (e: any) {
    // 3. fetch自体が失敗した場合（CORSやネットワークエラー）
    toast.error(`通信エラー: ${e.message}`);
    console.error("Fetch failed:", e);
  }
};

export const sendInventoryNotification = (msg: string) =>
  postToDiscord(INVENTORY_URL, `📦 **【在庫管理Bot】**\n${msg}`, "INVENTORY");

export const sendRequestNotification = (msg: string) =>
  postToDiscord(REQUEST_URL, `📝 **【出庫申請Bot】**\n${msg}`, "REQUEST");
