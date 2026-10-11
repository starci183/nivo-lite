import { Stepper as GrammarStepper } from "@starci/grammar/common";

/** Props for {@link Stepper}. */
export type StepperProps = { readonly steps: ReadonlyArray<string>; readonly current: 1 | 2 | 3; readonly label: string };

/** The three onboarding steps (Chọn gói -> Đặt tên -> Thanh toán) through Grammar's Stepper: earlier steps complete, the current one marked. */
export const Stepper = ({ steps, current, label }: StepperProps) => (
  <GrammarStepper
    label={label}
    steps={steps.map((s, i) => ({ id: `step-${i + 1}`, label: s }))}
    currentStepId={`step-${current}`}
  />
);
