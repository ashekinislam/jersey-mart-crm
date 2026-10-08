"use client";

import { useTransition } from "react";
import { isFrameworkNavigationError, useToast } from "./ToastProvider";

/** Drop-in replacement for `<form action={fn}>` that shows a toast once the
 * action finishes, instead of leaving the owner guessing whether a save/
 * update/delete actually went through. Actions that redirect (e.g. after
 * creating a record) still navigate normally -- the framework's redirect
 * error is detected and left to propagate rather than shown as a failure. */
export function FormWithToast({
  action,
  successMessage = "Saved",
  resetOnSuccess = false,
  className,
  id,
  children,
}: {
  /** May return `{ ok: false, error }` to show a validation message instead of the success toast. */
  action: (formData: FormData) => Promise<void | { ok: boolean; error?: string }>;
  successMessage?: string;
  /** Clear the inputs after a successful submit (for "add another" style forms). */
  resetOnSuccess?: boolean;
  className?: string;
  id?: string;
  children: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();

  return (
    <form
      id={id}
      className={className}
      aria-busy={isPending}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          try {
            const result = await action(formData);
            if (result && !result.ok) {
              showToast(result.error ?? "Couldn't save -- check the fields", "error");
              return;
            }
            showToast(successMessage);
            if (resetOnSuccess) form.reset();
          } catch (err) {
            if (isFrameworkNavigationError(err)) throw err;
            showToast("Something went wrong -- try again", "error");
          }
        });
      }}
    >
      {children}
    </form>
  );
}
