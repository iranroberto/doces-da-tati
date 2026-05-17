import { getSupabaseConfig } from "./_shared.js";

const textEncoder = new TextEncoder();

export const getVapidConfig = (env) => ({
  publicKey: String(env.VAPID_PUBLIC_KEY || ""),
  privateKey: String(env.VAPID_PRIVATE_KEY || ""),
  subject: String(env.VAPID_SUBJECT || "mailto:contato@docesdatati.local"),
});

export const hasVapidConfig = (env) => {
  const config = getVapidConfig(env);
  return Boolean(config.publicKey && config.privateKey);
};

const base64UrlToBytes = (value) => {
  const padded = `${value}${"=".repeat((4 - value.length % 4) % 4)}`;
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
};

const bytesToBase64Url = (bytes) => {
  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const stringToBase64Url = (value) => bytesToBase64Url(textEncoder.encode(value));

const createVapidJwt = async (env, audience) => {
  const { publicKey, privateKey, subject } = getVapidConfig(env);
  const publicKeyBytes = base64UrlToBytes(publicKey);
  const privateKeyBytes = base64UrlToBytes(privateKey);

  if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 4 || privateKeyBytes.length !== 32) {
    throw new Error("Chaves VAPID invalidas.");
  }

  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: bytesToBase64Url(publicKeyBytes.slice(1, 33)),
    y: bytesToBase64Url(publicKeyBytes.slice(33, 65)),
    d: bytesToBase64Url(privateKeyBytes),
    ext: false,
  };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = stringToBase64Url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = stringToBase64Url(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  }));
  const unsignedToken = `${header}.${claims}`;
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    textEncoder.encode(unsignedToken),
  ));

  return `${unsignedToken}.${bytesToBase64Url(signature)}`;
};

export const sendWebPush = async (env, subscription) => {
  const endpoint = String(subscription.endpoint || "");
  if (!endpoint) return { ok: false, status: 400 };

  const { publicKey } = getVapidConfig(env);
  const audience = new URL(endpoint).origin;
  const jwt = await createVapidJwt(env, audience);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${publicKey}`,
      TTL: "86400",
      Urgency: "normal",
    },
  });

  return { ok: response.ok, status: response.status };
};

export const deletePushSubscription = async (env, endpoint) => {
  const { url, key } = getSupabaseConfig(env);
  if (!url || !key || !endpoint) return;

  await fetch(`${url}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: "DELETE",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
  });
};
