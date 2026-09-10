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

  return (
    <div className="min-h-screen bg-slate-50">
      <Header email={user.email ?? ""} />
      <FollowUpBell />
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
