import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { getPublicTrackingData } from "@/lib/tracking";
import { PublicTrackingView } from "@/components/PublicTrackingView";

// Not indexed -- these links are meant to be private to whoever the owner sent them to,
// even though (like any link) they aren't literally password-protected.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = createServiceClient();
  const data = await getPublicTrackingData(supabase, token);
  if (!data) notFound();

  return <PublicTrackingView data={data} />;
}
