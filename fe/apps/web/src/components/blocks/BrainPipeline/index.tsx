"use client"

import { useTranslations } from "next-intl"
import { useBrainCommand, useBrainStats, useBrainUsage } from "@/hooks/brain"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { BrainPipelineBase } from "./component"

/** The connected pipeline: how many documents came in, what NIVO learnt, what waits for review and what the agents use, with the allowance meter. */
export const BrainPipeline = () => {
    const t = useTranslations("secondBrain")
    const brain = useTranslations("brain")
    const command = useBrainCommand()
    const slotLabels = useSlotLabels()
    const { slot, reload } = useBrainStats()
    const usage = useBrainUsage()
    return (
        <BrainPipelineBase
            props={{
                label: t("pipelineLabel"),
                usage,
                slotLabels: slotLabels(t("pipelineLabel")),
                pipeline: mapSlot(slot, ({ figures, agents, reading, isMaintenanceDue }) => ({
                    steps: [
                        {
                            id: "sources",
                            label: t("stepSources"),
                            value: String(figures.documents),
                            meta:
                                reading === null
                                    ? t("stepSourcesMeta", { n: figures.processing })
                                    : t("stepSourcesLive", {
                                          n: figures.processing,
                                          detail: [reading.stage, reading.count, `${Math.round(reading.value)}%`]
                                              .filter((part) => part !== null)
                                              .join(" · "),
                                      }),
                        },
                        {
                            id: "lessons",
                            label: t("stepLearn"),
                            value: String(figures.learned),
                            meta: t("stepLearnMeta", { facts: figures.learnedFacts, lessons: figures.learnedLessons }),
                        },
                        {
                            id: "review",
                            label: t("stepReview"),
                            value: String(figures.waiting),
                            meta: t("stepReviewMeta", { n: figures.conflicts }),
                        },
                        {
                            id: "facts",
                            label: t("stepUse"),
                            value: String(figures.facts),
                            meta: t("stepUseMeta", { n: agents }),
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
