"use client"

import { parseDate } from "@internationalized/date"
import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import type { StepFormView } from "@/components/composites/StepForm"
import { dateOnly, daysUntil, dueFromDate, splitResponsibilities, useLeadCommands, useStepView } from "@/hooks/leads"
import { faultTextOf } from "@/hooks/leadJourney"
import { loadingSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { writeSuggestOwner } from "@/modules/db/leads/write-lead-actions"
import { LEADS_ROUTES } from "@/modules/routes"
import type { LeadJourney, ResponsibilityRecord, DataSlot } from "@/modules/types"
import { LeadResponsibilityBase } from "./component"
import type { ResponsibilityView } from "./component"

/** The lead the panel acts on and the workspace it belongs to; a null detail draws the loading card. */
interface LeadResponsibilityProps {
    readonly detail: LeadJourney | null
    readonly workspaceId: string
}

type Mode = "reassign" | "add" | "due"

/** What a person has typed into the step form. */
interface Fields {
    readonly title: string
    readonly owner: string
    readonly nextAction: string
    readonly due: string | null
}

const HUMAN = "human"

const EMPTY_FIELDS: Fields = { title: "", owner: HUMAN, nextAction: "", due: null }

const ownerIdOf = (step: ResponsibilityRecord | null): string =>
    step?.owner_kind === "agent" && step.owner_agent_id ? step.owner_agent_id : HUMAN

/** The next-step panel: reassigning the owner, changing the due date, adding the next step and proposing an owner live here. */
export const LeadResponsibility = (props: LeadResponsibilityProps) => {
    const t = useTranslations("lead")
    const slotLabels = useSlotLabels()
    const format = useFormatter()
    const router = navigation.useRouter()
    const commands = useLeadCommands(props.workspaceId)
    const [isPending, startTransition] = useTransition()
    const [mode, setMode] = useState<Mode | null>(null)
    const [fields, setFields] = useState<Fields>(EMPTY_FIELDS)
    const [error, setError] = useState<string | null>(null)
    const [proposeError, setProposeError] = useState<string | null>(null)
    const detail = props.detail
    const { current } = splitResponsibilities(detail?.responsibilities ?? [])
    const agents = detail?.agents ?? []

    const open = (next: Mode) => {
        setError(null)
        setFields({
            title: "",
            owner: next === "add" ? HUMAN : ownerIdOf(current),
            nextAction: next === "add" ? "" : (current?.next_action ?? ""),
            due: next === "add" ? null : dateOnly(current?.due_at ?? null),
        })
        setMode(next)
    }
    const close = () => setMode(null)
    const send = async (loaded: LeadJourney, active: ResponsibilityRecord | null) => {
        const step = { owner: fields.owner, nextAction: fields.nextAction.trim(), dueAt: dueFromDate(fields.due) }
        if (mode === "add") return commands.addResponsibility(loaded.lead.id, fields.title.trim(), step)
        if (active === null) return null
        const nextAction = mode === "due" ? active.next_action : step.nextAction
        return commands.assignResponsibility(active.id, { ...step, nextAction })
    }
    const submit = () => {
        if (detail === null) return
        setError(null)
        startTransition(async () => {
            const result = await send(detail, current)
            if (result === null) {
                setError(t("noOpenStep"))
                return
            }
            if (result.kind !== "ok") {
                setError(faultTextOf(result))
                return
            }
            close()
            router.refresh()
        })
    }
    const propose = () => {
        if (detail === null) return
        setProposeError(null)
        startTransition(async () => {
            const result = await writeSuggestOwner(detail.lead.id)
            if (result.kind === "ok") router.refresh()
            else setProposeError(result.kind === "unavailable" ? result.code : t("proposeFailed"))
        })
    }

    const stepViewOf = useStepView(agents)
    const view: ResponsibilityView = { current: current === null ? null : stepViewOf(current) }
    const slot: DataSlot<ResponsibilityView> = detail === null ? loadingSlot() : { items: view }

    const formLabels: Readonly<Record<Mode, string>> = {
        add: t("formAdd"),
        due: t("formDue"),
        reassign: t("formReassign"),
    }
    const submitLabels: Readonly<Record<Mode, string>> = {
        add: t("addStep"),
        due: t("saveDue"),
        reassign: t("saveChanges"),
    }
    const form: StepFormView | null =
        mode === null
            ? null
            : {
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
                  error,
              }

    return (
        <LeadResponsibilityBase
            props={{
                slot,
                form,
                proposeError,
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
            }}
            on={{
                propose,
                open,
                close,
                change: (field, value) => setFields((previous) => ({ ...previous, [field]: value })),
                changeDue: (value) =>
                    setFields((previous) => ({ ...previous, due: value === null ? null : value.toString() })),
                submit,
            }}
        />
    )
}
