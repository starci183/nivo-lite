"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useLeadStepForm } from "@/hooks/rhf"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { LEADS_ROUTES, workspaceHref } from "@/modules/routes"
import type {
    LeadJourney,
    LeadStepMode,
    LeadStepPane,
    LeadStepSectionView,
    LeadStepValues,
    ResponsibilityRecord,
} from "@/modules/types"
import type { DateValue } from "@internationalized/date"
import { HUMAN_OWNER, dateOnly, dueFromDate, splitResponsibilities } from "./leads.shared"
import { useLeadActions } from "./useLeadActions"
import { useLeadCommands } from "./useLeadCommands"
import { useLeadJourney } from "./useLeadJourney"
import { useStepFormView } from "./useStepFormView"
import { useStepView } from "./useStepView"
import { useWorkspaceId } from "@/hooks/workspaces"

/** The next-step region and its commands. */
export interface LeadStepPaneView {
    readonly pane: LeadStepPane
    readonly on: {
        readonly propose: () => void
        readonly open: (mode: LeadStepMode) => void
        readonly close: () => void
        readonly change: (field: "title" | "owner" | "nextAction", value: string) => void
        readonly changeDue: (value: DateValue | null) => void
        readonly submit: () => void
    }
}

const ownerIdOf = (step: ResponsibilityRecord | null): string =>
    step?.owner_kind === "agent" && step.owner_agent_id ? step.owner_agent_id : HUMAN_OWNER

/** The words of the next-step region and its dialog. */
const useStepLabels = (): LeadStepPane["labels"] => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("lead")
    const slotLabels = useSlotLabels()
    return {
        title: t("nextStep"),
        nextStepLabel: t("nextStepWork"),
        dueLabel: t("due"),
        noDueLabel: t("noDue"),
        overdueLabel: t("overdue"),
        noOwnerTitle: t("noOwner"),
        noOwnerHint: t("noOwnerHint"),
        proposeLabel: t("proposeOwner"),
        proposeFailTitle: t("proposeFailed"),
        menuLabel: t("stepMenu"),
        reassignLabel: t("reassign"),
        changeDueLabel: t("changeDue"),
        askLabel: t("askInOffice"),
        askHref: workspaceHref(workspaceId, LEADS_ROUTES.chat),
        addLabel: t("formAdd"),
        form: {
            title: t("fieldTitle"),
            owner: t("fieldOwner"),
            nextStep: t("fieldNextStep"),
            due: t("fieldDue"),
            saveFailTitle: t("saveFailed"),
            cancel: t("cancel"),
            closeLabel: t("cancel"),
        },
        slot: slotLabels(t("noOwner")),
    }
}

/** The next step, its owner and due date, and the dialog that reassigns, changes the due date, adds a step or asks an owner to be proposed. */
export const useLeadStepPane = (leadId: string | undefined): LeadStepPaneView => {
    const t = useTranslations("lead")
    const labels = useStepLabels()
    const query = useLeadJourney(leadId)
    const commands = useLeadCommands()
    const actions = useLeadActions()
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
    const send = async (loaded: LeadJourney, input: LeadStepValues) => {
        const step = { owner: input.owner, nextAction: input.nextAction, dueAt: dueFromDate(input.due) }
        if (mode === "add") return commands.addResponsibility(loaded.lead.id, input.title, step)
        if (current === null) return null
        const nextAction = mode === "due" ? current.next_action : step.nextAction
        return commands.assignResponsibility(current.id, { ...step, nextAction })
    }
    const submit = rhf.onSubmit(async (input) => {
        if (detail === null) return
        setError(null)
        const result = await send(detail, input)
        if (result === null || result === undefined) {
            setError(t(result === null ? "noOpenStep" : "saveFailed"))
            return
        }
        setMode(null)
    })
    const stepViewOf = useStepView(agents)
    const view: LeadStepSectionView = { current: current === null ? null : stepViewOf(current) }
    return {
        pane: {
            slot: mapSlot(query.slot, () => view),
            form: useStepFormView(mode, rhf, agents, error),
            proposeError: proposeError ?? actions.error,
            isPending: commands.isMutating || actions.isPending,
            labels,
        },
        on: {
            propose: () => {
                if (detail === null) return
                setProposeError(null)
                void actions.suggestOwner(detail.lead.id).then((result) => {
                    if (result === undefined) setProposeError(t("proposeFailed"))
                })
            },
            open,
            close: () => setMode(null),
            change: (field, value) => rhf.setValue(field, value, { shouldDirty: true }),
            changeDue: (value) => rhf.setValue("due", value === null ? null : value.toString(), { shouldDirty: true }),
            submit: () => {
                void submit()
            },
        },
    }
}
