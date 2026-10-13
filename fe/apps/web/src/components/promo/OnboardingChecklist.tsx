"use client"

import { useId, useState } from "react"
import { Button, IconButton, List, ListItem, Meter, SurfaceCard, Text } from "@starci/grammar/common"
import { NivoIcon, nivoIconSource } from "@/ui"
import { useT } from "@/i18n/client"
import { promo } from "@/i18n/dict/promo"
import type { OnboardingStep } from "@/modules/promo"
import * as c from "./cardClassNames"

export type OnboardingChecklistProps = { readonly steps: ReadonlyArray<OnboardingStep> }

/**
 * Progress card built from real events; the first undone step is raised with its action. Collapses to "All set"
 * when done. Grammar owns the card and its labelled heading (`SurfaceCard label`), the progress (`Meter`), the
 * show/hide control (`IconButton` with aria-expanded) and the done mark (`Icon` + `Text isSuperseded`); the old
 * green check disc, raw toggle button and mascot are gone.
 */
export const OnboardingChecklist = ({ steps }: OnboardingChecklistProps) => {
    const t = useT(promo)
    const listId = useId()
    const [open, setOpen] = useState(true)
    const doneCount = steps.filter((s) => s.done).length
    if (steps.length === 0) return null
    if (doneCount === steps.length) {
        return (
            <div role="status">
                <SurfaceCard>
                    <div className={c.ALL_SET}>
                        <Text weight="medium">{t("allSet")}</Text>
                        <Text size="xs">{t("stepsComplete", { done: doneCount, total: steps.length })}</Text>
                    </div>
                </SurfaceCard>
            </div>
        )
    }
    const nextKey = steps.find((s) => !s.done)?.key
    return (
        <SurfaceCard
            label={t("checklistTitle")}
            headingLevel={2}
            labelEnd={
                <IconButton
                    variant="ghost"
                    source={nivoIconSource("disclosure", "leading")}
                    label={open ? t("hide") : t("show")}
                    aria-expanded={open}
                    aria-controls={listId}
                    onPress={() => setOpen((v) => !v)}
                />
            }
        >
            <div className={c.CHECK_BODY}>
                <Meter
                    label={t("setupProgress")}
                    value={doneCount}
                    minValue={0}
                    maxValue={steps.length}
                    valueLabel={t("progressValue", { done: doneCount, total: steps.length })}
                    tone="informative"
                />
                {open ? (
                    <List as="ol" id={listId} label={t("checklistTitle")} className={c.CHECK_LIST}>
                        {steps.map((step) => {
                            const isNext = step.key === nextKey
                            const mark = (
                                <NivoIcon props={{ name: step.done ? "complete" : "pending", usage: "leading" }} />
                            )
                            return (
                                <ListItem key={step.key} className={isNext ? c.STEP_NEXT : c.STEP}>
                                    <Text
                                        size="sm"
                                        weight={step.done ? "normal" : "medium"}
                                        tone={step.done ? "muted" : "default"}
                                        isSuperseded={step.done}
                                        startContent={mark}
                                    >
                                        {step.label}
                                        {step.done ? <span className="sr-only"> ({t("done")})</span> : null}
                                    </Text>
                                    {isNext ? (
                                        <>
                                            <Text size="xs">{step.hint}</Text>
                                            <Button variant="secondary" size="sm" href={step.href}>
                                                {step.cta}
                                            </Button>
                                        </>
                                    ) : null}
                                </ListItem>
                            )
                        })}
                    </List>
                ) : null}
            </div>
        </SurfaceCard>
    )
}
