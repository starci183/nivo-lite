"use client"

import { useTranslations } from "next-intl"
import type { IconGlyphName } from "@/components/leaves/Icon"
import { LandingFlowBase } from "./component"

type StepsShape = ReadonlyArray<{
    readonly n: number
    readonly icon: IconGlyphName
    readonly ai: boolean
    readonly human: boolean
}>

/**
 * Each step's identity glyph. The step mascots were removed: an illustration inside a card is a second
 * signature moment, and the page keeps only one.
 */
const STEPS: StepsShape = [
    { n: 1, icon: "send", ai: true, human: false },
    { n: 2, icon: "agentos", ai: true, human: false },
    { n: 3, icon: "review", ai: false, human: true },
    { n: 4, icon: "wallet", ai: true, human: false },
]

/** The landing flow section; the Grammar parts it draws read the loading region (client), so the block is a client block. */
export const LandingFlow = () => {
    const t = useTranslations("landing")
    return (
        <LandingFlowBase
            props={{
                headingId: "landing-flow",
                eyebrow: t("flowEyebrow"),
                title: t("flowTitle"),
                lead: t("flowLead"),
                emptyLabel: t("flowEmpty"),
                aiMark: t("flowAiMark"),
                humanTag: t("flowHuman"),
                steps: STEPS.map((step) => ({
                    id: `step${step.n}`,
                    stepLabel: t("flowStepLabel", { n: step.n }),
                    icon: step.icon,
                    agentName: t(`flow${step.n}Name`),
                    title: t(`flow${step.n}Title`),
                    text: t(`flow${step.n}Text`),
                    hasAiMark: step.ai,
                    isHumanStep: step.human,
                })),
            }}
        />
    )
}
