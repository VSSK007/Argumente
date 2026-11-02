"use client";

import { api } from "@/lib/api";

// Browser side of passkeys: convert the server's JSON options to the binary form WebAuthn wants, and back.

const b64urlToBuf = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0)).buffer;
};
const bufToB64url = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const passkeysSupported = () => typeof window !== "undefined" && !!window.PublicKeyCredential;

export async function registerPasskey(name: string) {
  const { challenge_id, options: o } = await api("/auth/passkeys/register/options", { body: {} });
  const cred = (await navigator.credentials.create({
    publicKey: {
      ...o,
      challenge: b64urlToBuf(o.challenge),
      user: { ...o.user, id: b64urlToBuf(o.user.id) },
      excludeCredentials: (o.excludeCredentials ?? []).map((c: any) => ({ ...c, id: b64urlToBuf(c.id) })),
    },
  })) as PublicKeyCredential;
  const r = cred.response as AuthenticatorAttestationResponse;
  const credential = {
    id: cred.id,
    rawId: bufToB64url(cred.rawId),
    type: cred.type,
    response: { clientDataJSON: bufToB64url(r.clientDataJSON), attestationObject: bufToB64url(r.attestationObject), transports: r.getTransports?.() ?? [] },
    clientExtensionResults: cred.getClientExtensionResults(),
  };
  return api("/auth/passkeys/register/verify", { body: { challenge_id, credential, name } });
}

export async function signInWithPasskey() {
  const { challenge_id, options: o } = await api("/auth/passkeys/login/options", { body: {} });
  const cred = (await navigator.credentials.get({
    publicKey: { ...o, challenge: b64urlToBuf(o.challenge), allowCredentials: (o.allowCredentials ?? []).map((c: any) => ({ ...c, id: b64urlToBuf(c.id) })) },
  })) as PublicKeyCredential;
  const r = cred.response as AuthenticatorAssertionResponse;
  const credential = {
    id: cred.id,
    rawId: bufToB64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufToB64url(r.clientDataJSON),
      authenticatorData: bufToB64url(r.authenticatorData),
      signature: bufToB64url(r.signature),
      userHandle: r.userHandle ? bufToB64url(r.userHandle) : null,
    },
    clientExtensionResults: cred.getClientExtensionResults(),
  };
  return api<{ token: string; user: any }>("/auth/passkeys/login/verify", { body: { challenge_id, credential } });
}
