"use client"

import { type LeadResponsibilityBaseProps, LeadResponsibilityBase, type ResponsibilityView } from "./component"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    HUMAN_OWNER,
    dateOnly,
    dueFromDate,
    splitResponsibilities,
    useLeadActions,
    useLeadCommands,
    useLeadJourney,
    useStepFormView,
    useStepView,
} from "@/hooks/leads"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useLeadStepForm } from "@/hooks/rhf"

import { LEADS_ROUTES } from "@/modules/routes"
import type {
    LeadJourney,
    LeadStepMode,
    LeadStepValues,
    ResponsibilityRecord,
    DataSlot,
    StepFormView,
} from "@/modules/types"

/** The lead the panel acts on and the workspace it belongs to; a null detail draws the loading card. */
interface LeadResponsibilityProps {
    readonly leadId?: string
}

/** Inputs needed to build the LeadResponsibilityContent section. */
interface BuildResponsibilityPanelViewContext {
    readonly slot: DataSlot<ResponsibilityView>
    readonly form: StepFormView | null
    readonly proposeError: string | null
    readonly actions: ReturnType<typeof useLeadActions>
    readonly isPending: boolean
    readonly t: ReturnType<typeof useTranslations<"lead">>
    readonly slotLabels: ReturnType<typeof useSlotLabels>
}

const ownerIdOf = (step: ResponsibilityRecord | null): string =>
    step?.owner_kind === "agent" && step.owner_agent_id ? step.owner_agent_id : HUMAN_OWNER

/** The next-step panel: reassigning the owner, changing the due date, adding the next step and proposing an owner live here. */
export const LeadResponsibility = (props: LeadResponsibilityProps) => {
    const t = useTranslations("lead")
    const slotLabels = useSlotLabels()
    const query = useLeadJourney(props.leadId)
    const commands = useLeadCommands()
    const actions = useLeadActions()
    const isPending = commands.isMutating || actions.isPending
    const [mode, setMode] = useState<LeadStepMode | null>(null)
    const rhf = useLeadStepForm(mode)
    const [error, setError] = useState<string | null>(null)
    const [proposeError, setProposeError] = useState<string | null>(null)
    const detail = query.detail
    const { current } = splitResponsibilities(detail?.responsibilities ?? [])
    const agents = detail?.agents ?? []

    const open = (next: LeadStepMode) => {
        setError(null)
        rhf.reset({
            title: "",
            owner: next === "add" ? HUMAN_OWNER : ownerIdOf(current),
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
    const form = useStepFormView(mode, rhf, agents, error)
    const view: ResponsibilityView = { current: current === null ? null : stepViewOf(current) }
    const slot: DataSlot<ResponsibilityView> = mapSlot(query.slot, () => view)

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
