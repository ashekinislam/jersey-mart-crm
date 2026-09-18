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
  className,
  id,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  successMessage?: string;
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
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          try {
            await action(formData);
            showToast(successMessage);
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
