import { fetchSupabaseRows, json } from "../_shared.js";

export const onRequestGet = async ({ env }) => {
  const { data, error } = await fetchSupabaseRows(
    env,
    "push_broadcasts?select=title,body,url,created_at&order=created_at.desc&limit=1",
  );

  if (error) {
    return json({
      title: "Doces da Tati",
      body: "Tem novidade esperando por voce.",
      url: "/",
    });
  }

  const message = Array.isArray(data) ? data[0] : null;
  return json({
    title: String(message?.title || "Doces da Tati"),
    body: String(message?.body || "Tem novidade esperando por voce."),
    url: String(message?.url || "/"),
    createdAt: String(message?.created_at || ""),
  });
};

export const onRequest = ({ request }) => json({ error: `Metodo ${request.method} nao permitido.` }, 405);
