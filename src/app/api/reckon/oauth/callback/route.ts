import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://jersey-mart-crm.vercel.app";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("reckon_oauth_state")?.value;
  cookieStore.delete("reckon_oauth_state");

  if (oauthError) {
    return NextResponse.redirect(
      `${APP_URL}/settings/reckon?error=${encodeURIComponent(oauthError)}`
    );
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      `${APP_URL}/settings/reckon?error=invalid_state`
    );
  }

  const clientId = process.env.RECKON_CLIENT_ID;
  const clientSecret = process.env.RECKON_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${APP_URL}/settings/reckon?error=not_configured`
    );
  }

  const redirectUri = `${APP_URL}/api/reckon/oauth/callback`;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  let tokenRes: Response;
  try {
    tokenRes = await fetch("https://identity.reckon.com/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
  } catch {
    return NextResponse.redirect(
      `${APP_URL}/settings/reckon?error=token_request_failed`
    );
  }

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      `${APP_URL}/settings/reckon?error=token_exchange_failed`
    );
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  const expiresAt = new Date(
    Date.now() + tokenData.expires_in * 1000
  ).toISOString();

  const { error: dbError } = await supabase.from("reckon_connections").upsert(
    {
      owner_id: user.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" }
  );

  if (dbError) {
    return NextResponse.redirect(
      `${APP_URL}/settings/reckon?error=save_failed`
    );
  }

  return NextResponse.redirect(`${APP_URL}/settings/reckon?connected=1`);
}
