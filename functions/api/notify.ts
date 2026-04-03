export const onRequestPost = async (context: any) => {
  try {
    const { type, message } = await context.request.json();

    const url =
      type === "inventory"
        ? context.env.VITE_INVENTORY_WEBHOOK_URL
        : context.env.VITE_REQUEST_WEBHOOK_URL;

    if (!url) {
      return new Response(JSON.stringify({ error: "URL undefined" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });

    const text = await response.text();

    return new Response(
      JSON.stringify({ ok: response.ok, status: response.status, body: text }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
