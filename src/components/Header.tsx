import Link from "next/link";
import { signOut } from "@/app/(app)/actions";

export function Header({ email }: { email: string }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-semibold text-slate-900">
            Jersey Mart CRM
          </Link>
          <Link
            href="/customers"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Customers
          </Link>
          <Link
            href="/leads"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Leads
          </Link>
          <Link
            href="/dispatch"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Dispatch
          </Link>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="hidden sm:inline">{email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
