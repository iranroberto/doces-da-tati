const urlBase64ToUint8Array = (value: string) => {
  const padded = `${value}${"=".repeat((4 - value.length % 4) % 4)}`;
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
};

export const canUsePushNotifications = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const getPushPermission = () => {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
};

export const subscribeToPushNotifications = async (customerId?: string) => {
  if (!canUsePushNotifications()) {
    throw new Error("Este navegador nao suporta notificacoes push.");
  }

  const keyResponse = await fetch("/api/push-public-key", { cache: "no-store" });
  const keyResult = await keyResponse.json();
  if (!keyResponse.ok || !keyResult.configured || !keyResult.publicKey) {
    throw new Error("Notificacoes ainda nao foram configuradas no servidor.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissao de notificacao nao concedida.");
  }

  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription = existingSubscription || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(String(keyResult.publicKey)),
  });

  const response = await fetch("/api/push-subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerId,
      subscription: subscription.toJSON(),
    }),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(String(result.error || "Nao foi possivel ativar notificacoes."));
  }

  return true;
};
