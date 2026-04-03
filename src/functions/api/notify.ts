export const onRequestPost = async (context: any) => {
  const { type, message } = await context.request.json();

  const url =
    type === "inventory"
      ? context.env.VITE_INVENTORY_WEBHOOK_URL
      : context.env.VITE_REQUEST_WEBHOOK_URL;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message }),
  });

  return new Response(JSON.stringify({ ok: response.ok }), {
    headers: { "Content-Type": "application/json" },
  });
};
