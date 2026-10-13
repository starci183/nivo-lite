"use client"

import type { ReactNode } from "react"
import { Heading, Progress, Text } from "@starci/grammar/common"
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

/**
 * The one frame every connection wizard shares, inside the Connections Drawer: "Bước n/N", the step's name and a Grammar Progress in
 * step mode, one segment per step (a horizontal Stepper cannot fit five labelled steps in a 24rem drawer), then the body and buttons.
 */
export const WizardFrame = ({ title, steps, index, children, footer }: WizardFrameProps) => {
    const t = useT(connectionWizard)
    const stepOf = t("stepOf", { n: index + 1, total: steps.length })
    return (
        <section className={WIZARD_CLASS} aria-label={title}>
            <div className={HEADER_CLASS}>
                <Text size="xs" tone="muted">
                    {stepOf}
                </Text>
                <Heading level={3}>{steps[index]}</Heading>
                <Progress label={stepOf} steps={{ total: steps.length, completed: index + 1 }} valueText={stepOf} />
            </div>
            <div className={BODY_CLASS}>{children}</div>
            <div className={FOOTER_CLASS}>{footer}</div>
        </section>
    )
}
