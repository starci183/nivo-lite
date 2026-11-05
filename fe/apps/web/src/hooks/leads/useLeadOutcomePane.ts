"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { useWatch } from "react-hook-form"
import { isEvidenceEvent } from "@/hooks/leadJourney"
import { useLeadOutcomeForm } from "@/hooks/rhf"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { EventRecord, LeadJourney, LeadOutcomePane, LeadOutcomeView, LeadStageId } from "@/modules/types"
import { ageOf, isStage, STAGE_KEYS, STAGE_ORDER } from "./leads.shared"
import { useLeadCommands } from "./useLeadCommands"
import { useLeadJourney } from "./useLeadJourney"

/** The outcome region of the aside, its dialog and their commands. */
export interface LeadOutcomePaneView {
    readonly pane: LeadOutcomePane
    readonly on: {
        readonly open: () => void
        readonly close: () => void
        readonly stage: (value: string) => void
        readonly evidence: (value: string) => void
        readonly submit: () => void
    }
}

/** The words of the outcome region and its dialog. */
const useOutcomeLabels = (): LeadOutcomePane["labels"] => {
    const t = useTranslations("lead")
    const tl = useTranslations("leads")
    const slotLabels = useSlotLabels()
    return {
        title: t("outcome"),
        stepperLabel: t("stageStepperLabel"),
        evidenceLead: t("evidenceLead"),
        recordLabel: t("recordOutcome"),
        stageLabel: t("fieldStage"),
        stageOptions: STAGE_ORDER.map((id) => ({ id, label: tl(STAGE_KEYS[id]) })),
        evidenceLabel: t("evidence"),
        evidenceHint: t("evidenceHint"),
        cancel: t("cancel"),
        failTitle: t("outcomeFailed"),
        recordedTitle: t("evidenceRecordedTitle"),
        slot: slotLabels(t("noEvidence")),
    }
}

/** Where the journey stands, the evidence kept, and the dialog that records a stage change with its evidence. */
export const useLeadOutcomePane = (leadId: string | undefined): LeadOutcomePaneView => {
    const t = useTranslations("lead")
    const tl = useTranslations("leads")
    const labels = useOutcomeLabels()
    const format = useFormatter()
    const query = useLeadJourney(leadId)
    const commands = useLeadCommands()
    const form = useLeadOutcomeForm()
    const values = useWatch({ control: form.control })
    const [error, setError] = useState<string | null>(null)
    const [isOpen, setOpen] = useState(false)
    const lead = query.detail?.lead ?? null
    const stageLabel = (value: LeadStageId): string => tl(STAGE_KEYS[value])
    const agoText = (iso: string): string => {
        const age = ageOf(iso, new Date().toISOString())
        if (age.unit === "now") return t("justNow")
        if (age.unit === "minutes") return t("minAgo", { count: age.n })
        if (age.unit === "hours") return t("hourAgo", { count: age.n })
        if (age.unit === "days") return t("dayAgo", { count: age.n })
        return format.dateTime(new Date(iso), { dateStyle: "medium" })
    }
    const viewOf = (loaded: LeadJourney): LeadOutcomeView => {
        const current = loaded.lead.stage
        const chosen = values.stage ?? current
        const isClosed = current === "won" || current === "lost"
        const recorded = loaded.events.filter(isEvidenceEvent)
        return {
            steps: [
                { id: "new", label: stageLabel("new") },
                { id: "qualified", label: stageLabel("qualified") },
                { id: "proposal", label: stageLabel("proposal") },
                {
                    id: "closed",
                    label: isClosed ? stageLabel(current) : t("wonOrLost"),
                    ...(current === "lost" ? { state: "error" as const } : {}),
                },
            ],
            currentStepId: isClosed ? "closed" : current,
            evidenceNote: recorded.length === 0 ? t("evidenceNone") : t("evidenceKept", { count: recorded.length }),
            stage: chosen,
            wonNote: chosen === "won" ? t("wonHandoff") : null,
            recorded: recorded.map((event: EventRecord) => ({
                id: event.id,
                byline: `${event.kind === "outcome.recorded" ? t("kindOutcome") : t("kindApproved")} · ${event.actor} · ${agoText(event.created_at)}`,
                text: event.evidence ?? "",
            })),
        }
    }
    const submit = form.handleSubmit(async (input) => {
        if (lead === null) return
        setError(null)
        const result = await commands.recordOutcome(lead.id, input.stage ?? lead.stage, input.evidence)
        if (result === undefined) {
            setError(t("outcomeFailed"))
            return
        }
        form.reset({ stage: input.stage, evidence: "" })
        setOpen(false)
    })
    return {
        pane: {
            slot: mapSlot(query.slot, viewOf),
            evidenceText: values.evidence ?? "",
            isDialogOpen: isOpen,
            error: error ?? form.formState.errors.evidence?.message ?? null,
            isPending: commands.isMutating,
            labels,
        },
        on: {
            open: () => setOpen(true),
            close: () => setOpen(false),
            stage: (value) => form.setValue("stage", isStage(value) ? value : null),
            evidence: (value) => form.setValue("evidence", value, { shouldDirty: true }),
            submit: () => {
                void submit()
            },
        },
    }
}
