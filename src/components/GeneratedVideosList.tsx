"use client";

import { useState, useTransition } from "react";
import { deleteGeneratedVideo, postGeneratedVideo, refreshVideoStatus } from "@/app/(app)/videos/actions";
import { VIDEO_STATUS_LABELS, VIDEO_TYPE_LABELS, type GeneratedVideo } from "@/lib/types";
import { useToast } from "@/components/ToastProvider";

const DEFAULT_VISIBLE_VIDEOS = 10;

const STATUS_COLORS: Record<GeneratedVideo["status"], string> = {
  draft: "bg-slate-100 text-slate-700",
  scripting: "bg-blue-100 text-blue-800",
  voicing: "bg-blue-100 text-blue-800",
  rendering: "bg-amber-100 text-amber-800",
  ready: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  posted: "bg-violet-100 text-violet-800",
};

const fmtDate = (d: string) =>
  new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(d)
  );

function VideoCard({ video }: { video: GeneratedVideo }) {
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();
  const script = (() => {
    try {
      return video.script ? (JSON.parse(video.script) as { headline: string; lines: string[] }) : null;
    } catch {
      return null;
    }
  })();

  function refresh() {
    startTransition(async () => {
      const result = await refreshVideoStatus(video.id);
      showToast(result.ok ? (result.message ?? "Updated") : result.error, result.ok ? "success" : "error");
    });
  }

  function post() {
    startTransition(async () => {
      const result = await postGeneratedVideo(video.id);
      showToast(result.ok ? (result.message ?? "Posted") : result.error, result.ok ? "success" : "error");
    });
  }

  function del() {
    if (!window.confirm("Delete this video?")) return;
    startTransition(async () => {
      const result = await deleteGeneratedVideo(video.id);
      showToast(result.ok ? "Deleted" : result.error, result.ok ? "success" : "error");
    });
  }

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[video.status]}`}>
            {VIDEO_STATUS_LABELS[video.status]}
          </span>
          <span className="text-sm font-medium text-slate-900">{VIDEO_TYPE_LABELS[video.video_type]}</span>
          <span className="text-xs text-slate-400">{fmtDate(video.created_at)}</span>
        </div>
        <div className="flex items-center gap-3">
          {video.status === "rendering" && (
            <button type="button" disabled={isPending} onClick={refresh} className="text-xs text-slate-500 underline hover:text-slate-800 disabled:opacity-50">
              {isPending ? "Checking…" : "Check status"}
            </button>
          )}
          {video.status === "ready" && (
            <button type="button" disabled={isPending} onClick={post} className="text-xs font-medium text-emerald-700 underline hover:text-emerald-900 disabled:opacity-50">
              {isPending ? "Posting…" : "Post now"}
            </button>
          )}
          <button type="button" disabled={isPending} onClick={del} className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-50">
            Delete
          </button>
        </div>
      </div>

      {script && (
        <div className="mt-2 text-xs text-slate-600">
          <p className="font-medium text-slate-800">&ldquo;{script.headline}&rdquo;</p>
          <p className="mt-0.5">{script.lines.join(" ")}</p>
        </div>
      )}

      {video.status === "failed" && video.error_message && (
        <p className="mt-2 text-xs text-red-700">⚠ {video.error_message}</p>
      )}

      {video.status === "ready" && video.output_url && (
        <div className="mt-3">
          <video src={video.output_url} controls className="max-h-96 rounded-md border border-slate-200" />
          <a href={video.output_url} download className="mt-1 block text-xs text-slate-500 underline hover:text-slate-800">
            Download
          </a>
        </div>
      )}
    </div>
  );
}

/** Renders just the video cards (+ show-more cap) -- the heading and period
 * picker live in the server-rendered page around this, since a function
 * prop like `hrefFor` can't cross into a Client Component. */
export function GeneratedVideosList({ videos }: { videos: GeneratedVideo[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = videos.length > DEFAULT_VISIBLE_VIDEOS;
  const visibleVideos = expanded ? videos : videos.slice(0, DEFAULT_VISIBLE_VIDEOS);

  if (videos.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">No videos in this period.</p>;
  }

  return (
    <>
      <div className="mt-3 space-y-3">
        {visibleVideos.map((v) => (
          <VideoCard key={v.id} video={v} />
        ))}
      </div>
      {hasMore && (
        <div className="pt-3 text-center">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-slate-500 underline hover:text-slate-800"
          >
            {expanded ? "Show fewer" : `Show all ${videos.length} (${videos.length - DEFAULT_VISIBLE_VIDEOS} more)`}
          </button>
        </div>
      )}
    </>
  );
}
