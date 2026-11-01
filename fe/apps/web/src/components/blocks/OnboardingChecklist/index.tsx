"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useOverviewData, useOverviewSteps } from "@/hooks/overview"
import { ONBOARDING_CHECKLIST_PLACEHOLDER, OnboardingChecklistBase } from "./component"

/** Progress card built from real events (inert geometry while the dashboard is read, nothing if it failed); the first undone step is raised with its action, and it collapses to "all set". */
export const OnboardingChecklist = () => {
    const t = useTranslations("promo")
    const [isOpen, setOpen] = useState(true)
    const read = useOverviewSteps()
    const { failed } = useOverviewData()
    if (read === undefined && failed) return null
    const steps = read ?? ONBOARDING_CHECKLIST_PLACEHOLDER
    const total = steps.length
    const done = steps.filter((step) => step.done).length
    return (
        <OnboardingChecklistBase
            props={{
                steps,
                isOpen,
                title: t("checklistTitle"),
                allSet: t("allSet"),
                allSetCount: t("stepsComplete", { done, total }),
                progressLabel: t("setupProgress"),
                progressValue: t("progressValue", { done, total }),
                toggleLabel: isOpen ? t("hide") : t("show"),
                doneLabel: t("done"),
                isSkeleton: read === undefined,
            }}
            on={{ toggle: () => setOpen((open) => !open) }}
        />
    )
}
