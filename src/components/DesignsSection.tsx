import {
  DESIGN_STATUS_COLORS,
  DESIGN_STATUS_LABELS,
  type Design,
  type DesignStage,
} from "@/lib/types";
import {
  deleteDesign,
  updateDesignStatus,
  uploadDesign,
} from "@/app/(app)/actions";
import { FILE_INPUT_CLASS } from "@/lib/ui";

function DesignCard({
  design,
  customerId,
  orderId,
  teamId,
  url,
}: {
  design: Design;
  customerId: string;
  orderId: string;
  teamId: string;
  url: string | null;
}) {
  const updateStatusWithIds = updateDesignStatus.bind(
    null,
    customerId,
    orderId,
    teamId,
    design.id
  );
  const deleteDesignWithIds = deleteDesign.bind(
    null,
    customerId,
    orderId,
    teamId,
    design.id
  );

  return (
    <div
      className={`rounded-md border p-3 ${
        design.status === "approved"
          ? "border-emerald-300 bg-emerald-50"
          : "border-slate-100 bg-slate-50"
      }`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={design.label ?? design.stage}
          className="w-full rounded-md border border-slate-200 object-cover"
        />
      ) : (
        <div className="flex h-32 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-400">
          Image unavailable
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-800">
          {design.label || new Date(design.created_at).toLocaleDateString()}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${DESIGN_STATUS_COLORS[design.status]}`}
        >
          {DESIGN_STATUS_LABELS[design.status]}
        </span>
      </div>

      <form action={updateStatusWithIds} className="mt-2 space-y-1.5">
        <select
          name="status"
          defaultValue={design.status}
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
        >
          <option value="pending">Pending review</option>
          <option value="approved">Approved</option>
          <option value="changes_requested">Changes requested</option>
        </select>
        <input
          name="notes"
          defaultValue={design.notes ?? ""}
          placeholder="Notes (e.g. requested changes)"
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
        />
        <div className="flex justify-between">
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-white"
          >
            Save
          </button>
        </div>
      </form>
      <form action={deleteDesignWithIds} className="mt-1">
        <button
          type="submit"
          className="text-xs text-slate-400 hover:text-red-600"
        >
          Delete
        </button>
      </form>
    </div>
  );
}

function StagePanel({
  title,
  stage,
  customerId,
  orderId,
  teamId,
  designs,
  urls,
}: {
  title: string;
  stage: DesignStage;
  customerId: string;
  orderId: string;
  teamId: string;
  designs: Design[];
  urls: Record<string, string>;
}) {
  const uploadWithIds = uploadDesign.bind(null, customerId, orderId, teamId);

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <form action={uploadWithIds} className="mt-2 space-y-2">
        <input type="hidden" name="stage" value={stage} />
        <input
          type="file"
          name="file"
          accept="image/*"
          required
          className={`block ${FILE_INPUT_CLASS}`}
        />
        <input
          name="label"
          placeholder="Label (optional, e.g. v2, back view)"
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
        />
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        >
          Upload
        </button>
      </form>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {designs.length === 0 && (
          <p className="col-span-2 text-xs text-slate-500">
            No images uploaded yet.
          </p>
        )}
        {designs.map((d) => (
          <DesignCard
            key={d.id}
            design={d}
            customerId={customerId}
            orderId={orderId}
            teamId={teamId}
            url={urls[d.storage_path] ?? null}
          />
        ))}
      </div>
    </div>
  );
}

export function DesignsSection({
  customerId,
  orderId,
  teamId,
  designs,
  urls,
}: {
  customerId: string;
  orderId: string;
  teamId: string;
  designs: Design[];
  urls: Record<string, string>;
}) {
  const byStage = (stage: DesignStage) =>
    designs
      .filter((d) => d.stage === stage)
      .sort((a, b) => {
        // Approved first, then newest first.
        if (a.status === "approved" && b.status !== "approved") return -1;
        if (b.status === "approved" && a.status !== "approved") return 1;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Designs</h2>
      <p className="mt-1 text-xs text-slate-500">
        Upload the AI concept you sent the customer, and later the
        supplier&apos;s machine-ready mockup, then track approval here.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StagePanel
          title="AI Concepts"
          stage="ai_concept"
          customerId={customerId}
          orderId={orderId}
          teamId={teamId}
          designs={byStage("ai_concept")}
          urls={urls}
        />
        <StagePanel
          title="Machine-ready mockups"
          stage="machine_ready"
          customerId={customerId}
          orderId={orderId}
          teamId={teamId}
          designs={byStage("machine_ready")}
          urls={urls}
        />
      </div>
    </section>
  );
}
