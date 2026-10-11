"use client"

import type { ReactNode } from "react"
import { Stepper } from "@starci/grammar/common"
import { BODY_CLASS, FOOTER_CLASS, WIZARD_CLASS } from "./classNames"

/** Props for {@link WizardFrame}. */
export type WizardFrameProps = {
  readonly title: string
  /** Step names, in order. */
  readonly steps: ReadonlyArray<string>
  readonly index: number
  readonly children: ReactNode
  /** The step's buttons: one filled primary, the rest outline/ghost. */
  readonly footer: ReactNode
}

/** The one frame every connection wizard shares (inside the Connections Drawer): the Grammar Stepper, the step body, its buttons. */
export const WizardFrame = ({ title, steps, index, children, footer }: WizardFrameProps) => (
  <section className={WIZARD_CLASS} aria-label={title}>
    <Stepper label={title} steps={steps.map((label, i) => ({ id: String(i), label }))} currentStepId={String(index)} />
    <div className={BODY_CLASS}>{children}</div>
    <div className={FOOTER_CLASS}>{footer}</div>
  </section>
)
