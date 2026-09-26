export const metadata = { title: "Privacy Policy — Jersey Mart CRM" };

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-slate-700">
      <h1 className="text-xl font-semibold text-slate-900">Privacy Policy</h1>
      <p className="mt-1 text-xs text-slate-400">Last updated 27 September 2026</p>

      <p className="mt-6">
        Jersey Mart CRM is an internal business-management tool built and used solely by Jersey Mart, an
        Australian custom sports-jersey business. It is not a public product — it has a single owner account and
        is not offered to other businesses or the public.
      </p>

      <h2 className="mt-6 text-base font-semibold text-slate-900">What data we handle</h2>
      <p className="mt-2">
        The app stores Jersey Mart&apos;s own business records: customer contact details, order and pricing
        information, jersey design files, and supplier/shipping costs. This data is entered by Jersey Mart&apos;s
        staff and is used only to run Jersey Mart&apos;s own operations.
      </p>

      <h2 className="mt-6 text-base font-semibold text-slate-900">Meta (Facebook/Instagram) integration</h2>
      <p className="mt-2">
        The app connects to Jersey Mart&apos;s own Facebook Page, Instagram Business account, and ad account to:
      </p>
      <ul className="mt-2 list-disc pl-5">
        <li>read advertising spend for Jersey Mart&apos;s own ad account, so it appears alongside other business costs;</li>
        <li>receive and reply to customer messages sent to Jersey Mart&apos;s Facebook Page or Instagram, so they can be handled from one place;</li>
        <li>publish promotional and educational videos, generated from Jersey Mart&apos;s own product photos, to Jersey Mart&apos;s own Facebook Page and Instagram account.</li>
      </ul>
      <p className="mt-2">
        None of this data is sold, shared with advertisers, or used for any purpose beyond operating Jersey
        Mart&apos;s own business and customer communications.
      </p>

      <h2 className="mt-6 text-base font-semibold text-slate-900">Service providers</h2>
      <p className="mt-2">
        The app relies on a small number of infrastructure providers to function: Supabase (database and file
        storage), Vercel (hosting), Anthropic and OpenAI (generating video scripts and product photos), ElevenLabs
        (generating voiceover audio), and AWS (rendering video files). These providers process data only as
        needed to perform those functions on Jersey Mart&apos;s behalf, and do not use it for their own purposes.
      </p>

      <h2 className="mt-6 text-base font-semibold text-slate-900">Data retention and deletion</h2>
      <p className="mt-2">
        Records are kept for as long as Jersey Mart needs them for its own business and accounting purposes.
        Jersey Mart can delete any customer, order, or message record directly within the app at any time.
      </p>

      <h2 className="mt-6 text-base font-semibold text-slate-900">Contact</h2>
      <p className="mt-2">
        Questions about this policy or the data it describes can be sent to{" "}
        <a href="mailto:ashekin.nahid@gmail.com" className="underline">
          ashekin.nahid@gmail.com
        </a>
        .
      </p>
    </div>
  );
}
