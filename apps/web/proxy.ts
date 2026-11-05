import { NextRequest, NextResponse } from "next/server";

/** Forwards /api/v1/* and the signing keys to the API, reading API_URL at *runtime* (not build time), so the same
 *  built image works on any host. Streams (SSE) pass through untouched. */
export function proxy(request: NextRequest) {
  const api = process.env.API_URL ?? "http://127.0.0.1:8000";
  const url = new URL(request.nextUrl.pathname + request.nextUrl.search, api);
  return NextResponse.rewrite(url);
}

export const config = { matcher: ["/api/v1/:path*", "/.well-known/argumente-keys.json"] };
