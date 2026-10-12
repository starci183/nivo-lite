"use client"

import { useTranslations } from "next-intl"
import { useId, useState } from "react"
import { OnboardingChecklistBase } from "./component"
import type { OnboardingChecklistStep } from "./component"

/** The steps to draw, computed from real events by the page. */
type OnboardingChecklistProps = { readonly steps: ReadonlyArray<OnboardingChecklistStep> }

/** Progress card built from real events; the first undone step is raised with its action, and it collapses to "all set". */
export const OnboardingChecklist = (props: OnboardingChecklistProps) => {
    const t = useTranslations("promo")
    const listId = useId()
    const [isOpen, setOpen] = useState(true)
    const total = props.steps.length
    const done = props.steps.filter((step) => step.done).length
    return (
        <OnboardingChecklistBase
            props={{
                steps: props.steps,
                isOpen,
                listId,
                title: t("checklistTitle"),
                allSet: t("allSet"),
                allSetCount: t("stepsComplete", { done, total }),
                progressLabel: t("setupProgress"),
                progressValue: t("progressValue", { done, total }),
                toggleLabel: isOpen ? t("hide") : t("show"),
                doneLabel: t("done"),
            }}
            on={{ toggle: () => setOpen((open) => !open) }}
        />
    )
}
