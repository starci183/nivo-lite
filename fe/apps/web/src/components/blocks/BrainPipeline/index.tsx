"use client"

import { useTranslations } from "next-intl"
import { useBrainCommand, useBrainStats } from "@/hooks/brain"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { brainTabHref } from "@/modules/routes"
import { BrainPipelineBase } from "./component"

/** The connected pipeline: how many documents came in, what NIVO learnt, what waits for review and what the agents use. */
export const BrainPipeline = () => {
    const t = useTranslations("secondBrain")
    const brain = useTranslations("brain")
    const command = useBrainCommand()
    const slotLabels = useSlotLabels()
    const { slot, reload } = useBrainStats()
    return (
        <BrainPipelineBase
            props={{
                label: t("pipelineLabel"),
                slotLabels: slotLabels(t("pipelineLabel")),
                pipeline: mapSlot(slot, ({ figures, agents, canDecide, isMaintenanceDue }) => ({
                    steps: [
                        {
                            id: "sources",
                            label: t("stepSources"),
                            value: String(figures.documents),
                            meta: t("stepSourcesMeta", { n: figures.processing }),
                            href: brainTabHref("sources"),
                            isWaiting: false,
                        },
                        {
                            id: "lessons",
                            label: t("stepLearn"),
                            value: String(figures.learned),
                            meta: t("stepLearnMeta", { facts: figures.learnedFacts, lessons: figures.learnedLessons }),
                            href: brainTabHref("lessons"),
                            isWaiting: false,
                        },
                        {
                            id: "review",
                            label: t("stepReview"),
                            value: String(figures.waiting),
                            meta: t("stepReviewMeta", { n: figures.conflicts }),
                            href: brainTabHref("review"),
                            isWaiting: canDecide && figures.waiting > 0,
                        },
                        {
                            id: "facts",
                            label: t("stepUse"),
                            value: String(figures.facts),
                            meta: t("stepUseMeta", { n: agents }),
                            href: brainTabHref("facts"),
                            isWaiting: false,
                        },
                    ],
                    maintain: isMaintenanceDue
                        ? {
                              title: brain("maintainTitle"),
                              body: brain("maintainBody"),
                              actionLabel: brain("maintainAction"),
                          }
                        : undefined,
                })),
            }}
            on={{ maintain: () => command.send("brain.maintain", undefined), retry: reload }}
        />
    )
}
