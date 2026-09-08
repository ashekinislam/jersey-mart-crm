"use client";

import { useTransition } from "react";

export function AutoSubmitInput({
  name,
  defaultValue,
  action,
  className,
  type = "date",
}: {
  name: string;
  defaultValue: string;
  action: (formData: FormData) => Promise<void>;
  className?: string;
  type?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <input
      type={type}
      name={name}
      defaultValue={defaultValue}
      disabled={isPending}
      className={`${className ?? ""} ${isPending ? "opacity-60" : ""}`}
      onChange={(e) => {
        const value = e.target.value;
        if (!value) return;
        const formData = new FormData();
        formData.set(name, value);
        startTransition(() => {
          action(formData);
        });
      }}
    />
  );
}
