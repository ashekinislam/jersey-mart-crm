"use client";

import { useTransition } from "react";
import { isFrameworkNavigationError, useToast } from "./ToastProvider";

export function AutoSubmitSelect({
  name,
  defaultValue,
  action,
  className,
  children,
}: {
  name: string;
  defaultValue: string;
  action: (formData: FormData) => Promise<void>;
  className?: string;
  children: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();

  return (
    <select
      name={name}
      defaultValue={defaultValue}
      disabled={isPending}
      className={`${className} ${isPending ? "opacity-60" : ""}`}
      onChange={(e) => {
        const value = e.target.value;
        const formData = new FormData();
        formData.set(name, value);
        startTransition(async () => {
          try {
            await action(formData);
            showToast("Saved");
          } catch (err) {
            if (isFrameworkNavigationError(err)) throw err;
            showToast("Something went wrong -- try again", "error");
          }
        });
      }}
    >
      {children}
    </select>
  );
}
