"use client"

import { parseDate } from "@internationalized/date"
import { useTranslations } from "next-intl"
import type { FieldErrors } from "react-hook-form"
import type { AgentRecord, LeadStepMode, LeadStepValues, StepFormView } from "@/modules/types"
import { HUMAN_OWNER } from "./leads.shared"

/** What the next-step form hook holds: the watched fields, the words of each mode and the validation errors. */
interface StepFormSource {
    readonly fields: LeadStepValues
    readonly formLabels: Readonly<Record<LeadStepMode, string>>
    readonly submitLabels: Readonly<Record<LeadStepMode, string>>
    readonly formState: { readonly errors: FieldErrors<LeadStepValues> }
}

/** The next-step form as the step form draws it: the fields, the owner choices and the first error; null while it is closed. */
export const useStepFormView = (
    mode: LeadStepMode | null,
    rhf: StepFormSource,
    agents: ReadonlyArray<AgentRecord>,
    error: string | null,
): StepFormView | null => {
    const t = useTranslations("lead")
    if (mode === null) return null
    const { fields } = rhf
    return {
        mode,
        label: rhf.formLabels[mode],
        title: fields.title,
        owner: fields.owner,
        nextAction: fields.nextAction,
        due: fields.due === null ? null : parseDate(fields.due),
        ownerOptions: [
            { id: HUMAN_OWNER, label: t("ownerYou") },
            ...agents
                .filter((agent) => agent.status === "active" || agent.id === fields.owner)
                .map((agent) => ({ id: agent.id, label: `${agent.name} (@${agent.handle.replace(/^@/, "")})` })),
        ],
        submitLabel: rhf.submitLabels[mode],
        error: error ?? Object.values(rhf.formState.errors)[0]?.message ?? null,
    }
}
