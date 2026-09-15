import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://jersey-mart-crm.vercel.app";

export async function GET() {
  const clientId = process.env.RECKON_CLIENT_ID;
  const scope = process.env.RECKON_OAUTH_SCOPE;

  if (!clientId || !scope) {
    return NextResponse.redirect(
      `${APP_URL}/settings/reckon?error=not_configured`
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("reckon_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const redirectUri = `${APP_URL}/api/reckon/oauth/callback`;
  const authorizeUrl = new URL("https://identity.reckon.com/connect/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", scope);
  authorizeUrl.searchParams.set("state", state);

  return NextResponse.redirect(authorizeUrl.toString());
}
