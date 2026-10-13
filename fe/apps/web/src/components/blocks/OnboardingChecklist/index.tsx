"use client"

import { useTranslations } from "next-intl"
import { useId, useState } from "react"
import { useOverviewSteps } from "@/hooks/overview"
import { OnboardingChecklistBase } from "./component"

/** Progress card built from real events; the first undone step is raised with its action, and it collapses to "all set". */
export const OnboardingChecklist = () => {
    const t = useTranslations("promo")
    const listId = useId()
    const [isOpen, setOpen] = useState(true)
    const steps = useOverviewSteps()
    if (steps === undefined) return null
    const total = steps.length
    const done = steps.filter((step) => step.done).length
    return (
        <OnboardingChecklistBase
            props={{
                steps,
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
