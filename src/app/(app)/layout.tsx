import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { FollowUpBell } from "@/components/FollowUpBell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { count: pendingAiDrafts } = await supabase
    .from("ai_drafts")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <div className="min-h-screen bg-slate-50">
      <Header email={user.email ?? ""} pendingAiDrafts={pendingAiDrafts ?? 0} />
      <FollowUpBell />
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
