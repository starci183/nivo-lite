"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import type { DriveStepId, DriveGrantStanding } from "./drive.shared"
import { useDrivePage } from "./useDrivePage"
import { useDriveProgress } from "./useDriveProgress"

/** The view `useDriveSteps` returns. */
export interface DriveStepsView {
    steps: {
        id: DriveStepId
        title: string
        hint: string
        summary: string
        isOpen: boolean
    }[]
    standing: DriveGrantStanding | undefined
    toggle: (id: string, isOpen: boolean) => void
}

/**
 * The three steps of the Google Drive page (grant the read access, choose documents, find them in Second Brain): the grant is done once
 * Google answered, choosing is done once a source came from Drive, and the first step not done opens on its own.
 */
export const useDriveSteps = (): DriveStepsView => {
    const t = useTranslations("driveConnection")
    const { slot } = useDrivePage()
    const { count } = useDriveProgress()
    const [toggled, setToggled] = useState<Readonly<Partial<Record<string, boolean>>>>({})
    const page = "items" in slot ? slot.items : undefined
    const isGranted = page?.standing === "connected"
    const grantSummary = page?.standing === "lost" ? t("stepGrantLost") : t("stepTodo")
    const chooseSummary = isGranted ? t("stepTodo") : ""
    const wording = {
        grant: {
            title: t("stepGrant"),
            hint: t("stepGrantHint"),
            summary: isGranted ? t("stepGrantDone", { email: page?.email ?? "" }) : grantSummary,
        },
        choose: {
            title: t("stepChoose"),
            hint: t("stepChooseHint"),
            summary: count > 0 ? t("stepChooseDone", { count }) : chooseSummary,
        },
        brain: { title: t("stepBrain"), hint: t("stepBrainHint"), summary: t("stepBrainSummary") },
    } as const satisfies Readonly<
        Record<DriveStepId, { readonly title: string; readonly hint: string; readonly summary: string }>
    >
    const opensOn: DriveStepId = isGranted ? "choose" : "grant"
    const order: ReadonlyArray<DriveStepId> = ["grant", "choose", "brain"]
    const steps = order.map((id) => ({
        id,
        title: wording[id].title,
        hint: wording[id].hint,
        summary: page === undefined ? "" : wording[id].summary,
        isOpen: toggled[id] ?? (page !== undefined && id === opensOn),
    }))
    return {
        steps,
        standing: page?.standing,
        toggle: (id: string, isOpen: boolean) => setToggled((current) => ({ ...current, [id]: isOpen })),
    }
}
