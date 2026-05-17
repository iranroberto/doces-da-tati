import { corsHeaders, json } from "../_shared.js";

export const onRequestOptions = () => new Response(null, { status: 204, headers: corsHeaders });

export const onRequestPost = () => json({ error: "Pagamento por cartao foi desativado." }, 410);

export const onRequest = ({ request }) => json({ error: `Metodo ${request.method} nao permitido.` }, 405);
