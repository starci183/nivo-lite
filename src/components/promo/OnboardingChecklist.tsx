"use client";

import { useState } from "react";
import { Button, Meter } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { promo } from "@/i18n/dict/promo";
import type { OnboardingStep } from "@/features/promo/queries";
import * as c from "./cardClassNames";

export type OnboardingChecklistProps = { readonly steps: ReadonlyArray<OnboardingStep> };

/** Progress card built from real events; the first undone step is highlighted with its action. Collapses to "All set" when done. */
export const OnboardingChecklist = ({ steps }: OnboardingChecklistProps) => {
  const t = useT(promo);
  const [open, setOpen] = useState(true);
  const doneCount = steps.filter((s) => s.done).length;
  if (steps.length === 0) return null;
  if (doneCount === steps.length) {
    return (
      <div className={c.ALL_SET} role="status">
        <p className={c.STEP_LABEL}>{t("allSet")}</p>
        <p className={c.STEP_HINT}>{t("stepsComplete", { done: doneCount, total: steps.length })}</p>
      </div>
    );
  }
  const nextKey = steps.find((s) => !s.done)?.key;
  return (
    <section className={c.CARD} aria-label={t("checklistTitle")}>
      <div className={c.CHECK_HEAD}>
        <div className={c.CHECK_TITLE_WRAP}>
          <img className={c.CHECK_ART} src="/images/promo/mascot-checklist.png" alt="" />
          <h2 className={c.CHECK_TITLE}>{t("checklistTitle")}</h2>
        </div>
        <button type="button" className={c.CHECK_TOGGLE} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? t("hide") : t("show")}
        </button>
      </div>
      <div className="mt-3">
        <Meter label={t("setupProgress")} value={doneCount} minValue={0} maxValue={steps.length} valueLabel={t("progressValue", { done: doneCount, total: steps.length })} tone="informative" />
      </div>
      {open ? (
        <ol className={c.CHECK_LIST}>
          {steps.map((step) => {
            const isNext = step.key === nextKey;
            return (
              <li key={step.key} className={isNext ? c.STEP_NEXT : c.STEP}>
                <span className={step.done ? c.STEP_MARK_DONE : c.STEP_MARK} aria-hidden="true">
                  {step.done ? "✓" : ""}
                </span>
                <div className={c.STEP_BODY}>
                  <span className={step.done ? c.STEP_LABEL_DONE : c.STEP_LABEL}>
                    {step.label}
                    {step.done ? <span className="sr-only"> ({t("done")})</span> : null}
                  </span>
                  {isNext ? (
                    <>
                      <span className={c.STEP_HINT}>{step.hint}</span>
                      <Button variant="secondary" size="sm" href={step.href}>
                        {step.cta}
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
};
