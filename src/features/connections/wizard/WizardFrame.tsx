"use client"

import type { ReactNode } from "react"
import { Heading, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { BODY_CLASS, FOOTER_CLASS, HEADER_CLASS, SEGMENTS_CLASS, SEGMENT_CLASS, SEGMENT_DONE_CLASS, WIZARD_CLASS } from "./classNames"

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

/** The one frame every connection wizard shares: title, "Bước n/N" with a segmented progress line, the step body, its buttons. */
export const WizardFrame = ({ title, steps, index, children, footer }: WizardFrameProps) => {
  const t = useT(connectionWizard)
  return (
    <section className={WIZARD_CLASS} aria-label={title}>
      <div className={HEADER_CLASS}>
        <Text size="xs" tone="muted">{title}</Text>
        <div className={SEGMENTS_CLASS} style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-hidden="true">
          {steps.map((s, i) => <div key={s} className={i <= index ? SEGMENT_DONE_CLASS : SEGMENT_CLASS} />)}
        </div>
        <Text size="xs" tone="muted">{t("stepOf", { n: index + 1, total: steps.length })}</Text>
        <Heading level={3}>{steps[index]}</Heading>
      </div>
      <div className={BODY_CLASS}>{children}</div>
      <div className={FOOTER_CLASS}>{footer}</div>
    </section>
  )
}
