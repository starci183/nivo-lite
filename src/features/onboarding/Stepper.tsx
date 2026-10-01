import { Fragment } from "react";
import {
  STEPPER_CLASS_NAME, STEP_CLASS_NAME, STEP_DOT_CLASS_NAME, STEP_DOT_DONE_CLASS_NAME, STEP_DOT_NEXT_CLASS_NAME, STEP_DOT_NOW_CLASS_NAME,
  STEP_LABEL_CLASS_NAME, STEP_LABEL_NOW_CLASS_NAME, STEP_LINE_CLASS_NAME,
} from "./classNames";

/** Props for {@link Stepper}. */
export type StepperProps = { readonly steps: ReadonlyArray<string>; readonly current: 1 | 2 | 3; readonly label: string };

const Check = () => (
  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);

/** A calm three-step indicator: done steps are filled crimson, the current one is blush, the rest are outlined. */
export const Stepper = ({ steps, current, label }: StepperProps) => (
  <ol className={STEPPER_CLASS_NAME} aria-label={label}>
    {steps.map((s, i) => {
      const n = i + 1;
      const state = n < current ? "done" : n === current ? "now" : "next";
      const dot = state === "done" ? STEP_DOT_DONE_CLASS_NAME : state === "now" ? STEP_DOT_NOW_CLASS_NAME : STEP_DOT_NEXT_CLASS_NAME;
      return (
        <Fragment key={s}>
          {i > 0 ? <li aria-hidden="true" className={STEP_LINE_CLASS_NAME} style={{ background: "#CBD5E1" }} /> : null}
          <li className={STEP_CLASS_NAME} aria-current={state === "now" ? "step" : undefined}>
            <span className={`${STEP_DOT_CLASS_NAME} ${dot}`}>{state === "done" ? <Check /> : n}</span>
            <span className={`${STEP_LABEL_CLASS_NAME} ${state === "now" ? STEP_LABEL_NOW_CLASS_NAME : "text-muted"}`}>{s}</span>
          </li>
        </Fragment>
      );
    })}
  </ol>
);
