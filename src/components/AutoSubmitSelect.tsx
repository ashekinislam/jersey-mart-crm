"use client";

import { useTransition } from "react";

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
        startTransition(() => {
          action(formData);
        });
      }}
    >
      {children}
    </select>
  );
}
