import { parseDate } from "@internationalized/date"
import type { useTranslations } from "next-intl"
import type { StepFormView } from "@/components/composites/StepForm"
import type { LeadStepValues, useLeadStepForm } from "@/hooks/rhf"
import type { AgentRecord } from "@/modules/types"

/** The supported next-step editing action. */
export type Mode = "reassign" | "add" | "due"

/** The form value representing a human owner. */
export const HUMAN = "human"

/** Inputs needed to build the next-step form view. */
interface BuildStepFormViewContext {
    readonly mode: Mode
    readonly formLabels: Readonly<Record<Mode, string>>
    readonly fields: LeadStepValues
    readonly t: ReturnType<typeof useTranslations<"lead">>
    readonly agents: readonly AgentRecord[]
    readonly submitLabels: Readonly<Record<Mode, string>>
    readonly error: string | null
    readonly rhf: ReturnType<typeof useLeadStepForm>
}

/** Builds the next-step form view from the current mode and form fields. */
export const buildStepFormView = ({
    mode,
    formLabels,
    fields,
    t,
    agents,
    submitLabels,
    error,
    rhf,
}: BuildStepFormViewContext): StepFormView => ({
    mode,
    label: formLabels[mode],
    title: fields.title,
    owner: fields.owner,
    nextAction: fields.nextAction,
    due: fields.due === null ? null : parseDate(fields.due),
    ownerOptions: [
        { id: HUMAN, label: t("ownerYou") },
        ...agents
            .filter((agent) => agent.status === "active" || agent.id === fields.owner)
            .map((agent) => ({
                id: agent.id,
                label: `${agent.name} (@${agent.handle.replace(/^@/, "")})`,
            })),
    ],
    submitLabel: submitLabels[mode],
    error: error ?? Object.values(rhf.formState.errors)[0]?.message ?? null,
})
