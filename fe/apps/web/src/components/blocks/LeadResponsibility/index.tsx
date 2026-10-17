"use client"

import { HUMAN } from "./component"

import type {
    LeadResponsibilityProps,
    Mode,
    BuildResponsibilityPanelViewContext,
    BuildStepFormViewContext,
    LeadResponsibilityBaseProps,
} from "./component"
import { parseDate } from "@internationalized/date"
import { useTranslations } from "next-intl"
import { useState } from "react"
import type { StepFormView } from "@/components/composites/StepForm"
import {
    dateOnly,
    dueFromDate,
    splitResponsibilities,
    useLeadActions,
    useLeadCommands,
    useLeadJourney,
    useStepView,
} from "@/hooks/leads"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useLeadStepForm } from "@/hooks/rhf"
import type { LeadStepValues } from "@/hooks/rhf"
import { LEADS_ROUTES } from "@/modules/routes"
import type { LeadJourney, ResponsibilityRecord, DataSlot } from "@/modules/types"
import { LeadResponsibilityBase } from "./component"
import type { ResponsibilityView } from "./component"

const ownerIdOf = (step: ResponsibilityRecord | null): string =>
    step?.owner_kind === "agent" && step.owner_agent_id ? step.owner_agent_id : HUMAN

/** The next-step panel: reassigning the owner, changing the due date, adding the next step and proposing an owner live here. */
export const LeadResponsibility = (props: LeadResponsibilityProps) => {
    const t = useTranslations("lead")
    const slotLabels = useSlotLabels()
    const query = useLeadJourney(props.leadId)
    const commands = useLeadCommands()
    const actions = useLeadActions()
    const isPending = commands.isMutating || actions.isPending
    const [mode, setMode] = useState<Mode | null>(null)
    const rhf = useLeadStepForm(mode)
    const { fields, formLabels, submitLabels } = rhf
    const [error, setError] = useState<string | null>(null)
    const [proposeError, setProposeError] = useState<string | null>(null)
    const detail = query.detail
    const { current } = splitResponsibilities(detail?.responsibilities ?? [])
    const agents = detail?.agents ?? []

    const open = (next: Mode) => {
        setError(null)
        rhf.reset({
            title: "",
            owner: next === "add" ? HUMAN : ownerIdOf(current),
            nextAction: next === "add" ? "" : (current?.next_action ?? ""),
            due: next === "add" ? null : dateOnly(current?.due_at ?? null),
        })
        setMode(next)
    }
    const close = () => setMode(null)
    const send = async (loaded: LeadJourney, active: ResponsibilityRecord | null, input: LeadStepValues) => {
        const step = { owner: input.owner, nextAction: input.nextAction, dueAt: dueFromDate(input.due) }
        if (mode === "add") return commands.addResponsibility(loaded.lead.id, input.title, step)
        if (active === null) return null
        const nextAction = mode === "due" ? active.next_action : step.nextAction
        return commands.assignResponsibility(active.id, { ...step, nextAction })
    }
    const submit = rhf.handleSubmit(async (input) => {
        if (detail === null) return
        setError(null)
        const result = await send(detail, current, input)
        if (result === null || result === undefined) {
            setError(t(result === null ? "noOpenStep" : "saveFailed"))
            return
        }
        close()
    })
    const propose = () => {
        if (detail === null) return
        setProposeError(null)
        void actions.suggestOwner(detail.lead.id).then((result) => {
            if (result === undefined) setProposeError(t("proposeFailed"))
        })
    }

    const stepViewOf = useStepView(agents)
    const view: ResponsibilityView = { current: current === null ? null : stepViewOf(current) }
    const slot: DataSlot<ResponsibilityView> = mapSlot(query.slot, () => view)

    const form: StepFormView | null =
        mode === null ? null : buildStepFormView({ mode, formLabels, fields, t, agents, submitLabels, error, rhf })

    return (
        <LeadResponsibilityBase
            props={buildResponsibilityPanelView({ slot, form, proposeError, actions, isPending, t, slotLabels })}
            on={{
                propose,
                open,
                close,
                change: (field, value) => rhf.setValue(field, value, { shouldDirty: true }),
                changeDue: (value) =>
                    rhf.setValue("due", value === null ? null : value.toString(), { shouldDirty: true }),
                submit: () => {
                    void submit()
                },
            }}
        />
    )
}
/** Builds the LeadResponsibilityContent section from the current view. */
const buildResponsibilityPanelView = ({
    slot,
    form,
    proposeError,
    actions,
    isPending,
    t,
    slotLabels,
}: BuildResponsibilityPanelViewContext): LeadResponsibilityBaseProps["props"] => ({
    slot,
    form,
    proposeError: proposeError ?? actions.error,
    isPending,
    labels: {
        cardLabel: t("nextStepOwner"),
        nextStepLabel: t("nextStep"),
        accountableLabel: t("accountable"),
        dueLabel: t("due"),
        noDueLabel: t("noDue"),
        overdueLabel: t("overdue"),
        noOwnerTitle: t("noOwner"),
        noOwnerHint: t("noOwnerHint"),
        proposeLabel: t("proposeOwner"),
        proposeFailTitle: t("proposeFailed"),
        reassignLabel: t("reassign"),
        changeDueLabel: t("changeDue"),
        askLabel: t("askInOffice"),
        askHref: LEADS_ROUTES.chat,
        addLabel: t("formAdd"),
        form: {
            title: t("fieldTitle"),
            owner: t("fieldOwner"),
            nextStep: t("fieldNextStep"),
            due: t("fieldDue"),
            saveFailTitle: t("saveFailed"),
            cancel: t("cancel"),
        },
        slot: slotLabels(t("noOwner")),
    },
})
/** Builds the LeadResponsibilityContent section from the current view. */
const buildStepFormView = ({
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
