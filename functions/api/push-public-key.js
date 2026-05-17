import { json } from "../_shared.js";
import { getVapidConfig, hasVapidConfig } from "../_push.js";

export const onRequestGet = ({ env }) => {
  const { publicKey } = getVapidConfig(env);

  return json({
    publicKey,
    configured: hasVapidConfig(env),
  });
};

export const onRequest = ({ request }) => json({ error: `Metodo ${request.method} nao permitido.` }, 405);
