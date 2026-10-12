"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "./actions";
import { useLocale } from "./client";
import type { Locale } from "./core";

const OPTIONS: ReadonlyArray<{ id: Locale; label: string; name: string }> = [
  { id: "vi", label: "VI", name: "Tiếng Việt" },
  { id: "en", label: "EN", name: "English" },
];

/** VI | EN segmented switch for the top bar and the login page. */
export const LocaleSwitch = () => {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="nivo-locale-switch" role="radiogroup" aria-label="Language / Ngôn ngữ" aria-busy={pending}>
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={locale === o.id}
          aria-label={o.name}
          title={o.name}
          disabled={pending}
          onClick={() => {
            if (o.id === locale) return;
            start(async () => {
              await setLocale(o.id);
              router.refresh();
            });
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
};
