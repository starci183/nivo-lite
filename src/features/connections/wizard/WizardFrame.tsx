"use client"

import type { ReactNode } from "react"
import { Divider, Heading, Stepper, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { BODY_CLASS, FOOTER_CLASS, HEADER_CLASS, WIZARD_CLASS } from "./classNames"

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

/** The one frame every connection wizard shares: title, "Bước n/N" with the Grammar Stepper, the step body, its buttons. */
export const WizardFrame = ({ title, steps, index, children, footer }: WizardFrameProps) => {
  const t = useT(connectionWizard)
  const items = steps.map((label, i) => ({ id: `step-${i}`, label }))
  return (
    <>
      <Divider semantics="presentation" />
      <section className={WIZARD_CLASS} aria-label={title}>
        <div className={HEADER_CLASS}>
          <Text size="xs" tone="muted">{title}</Text>
          <Stepper label={title} steps={items} currentStepId={`step-${index}`} />
          <Text size="xs" tone="muted">{t("stepOf", { n: index + 1, total: steps.length })}</Text>
          <Heading level={3}>{steps[index]}</Heading>
        </div>
        <div className={BODY_CLASS}>{children}</div>
        <div className={FOOTER_CLASS}>{footer}</div>
      </section>
    </>
  )
}
