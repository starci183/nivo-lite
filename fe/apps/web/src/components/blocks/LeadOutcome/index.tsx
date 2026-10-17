"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { ageOf, STAGE_KEYS, STAGE_ORDER, useLeadCommands, useLeadJourney } from "@/hooks/leads"
import { isEvidenceEvent } from "@/hooks/leadJourney"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useWatch } from "react-hook-form"
import { useLeadOutcomeForm } from "@/hooks/rhf"
import type { EventRecord, LeadJourney, LeadStageId, DataSlot } from "@/modules/types"
import { LeadOutcomeBase } from "./component"
import type { OutcomeView } from "./component"

/** The lead the card acts on and its workspace; a null detail draws the loading card. */
interface LeadOutcomeProps {
    readonly leadId?: string
}

const isStage = (value: string): value is LeadStageId => STAGE_ORDER.some((stage) => stage === value)

/** The outcome card: the stage choice and the evidence text live here, the drawing in the pure half. */
export const LeadOutcome = (props: LeadOutcomeProps) => {
    const t = useTranslations("lead")
    const tl = useTranslations("leads")
    const slotLabels = useSlotLabels()
    const format = useFormatter()
    const query = useLeadJourney(props.leadId)
    const commands = useLeadCommands()
    const isPending = commands.isMutating
    const detail = query.detail
    const form = useLeadOutcomeForm()
    const values = useWatch({ control: form.control })
    const stage = values.stage ?? null
    const evidence = values.evidence ?? ""
    const [error, setError] = useState<string | null>(null)
    const lead = detail?.lead ?? null
    const stageLabel = (value: LeadStageId): string => tl(STAGE_KEYS[value])
    const ladder = [t("evPending"), t("evCaptured"), t("evReviewed"), t("evVerified"), t("evCustomerConfirmed")]
    const agoText = (iso: string): string => {
        const age = ageOf(iso, new Date().toISOString())
        if (age.unit === "now") return t("justNow")
        if (age.unit === "minutes") return t("minAgo", { count: age.n })
        if (age.unit === "hours") return t("hourAgo", { count: age.n })
        if (age.unit === "days") return t("dayAgo", { count: age.n })
        return format.dateTime(new Date(iso), { dateStyle: "medium" })
    }
    const evidenceOf = (event: EventRecord) => {
        const kindKey = event.kind === "outcome.recorded" ? "kindOutcome" : "kindApproved"
        return {
            id: event.id,
            byline: `· ${t(kindKey)} · ${event.actor} · ${agoText(event.created_at)}`,
            text: event.evidence ?? "",
        }
    }
    const viewOf = (loaded: LeadJourney): OutcomeView => {
        const current = loaded.lead.stage
        const chosen = stage ?? current
        const recorded = loaded.events.filter(isEvidenceEvent)
        const evidenceStep = recorded.length === 0 ? 1 : 2
        const isClosed = current === "won" || current === "lost"
        return buildOutcomeSummary({
            t,
            stageLabel,
            current,
            isClosed,
            evidenceStep,
            ladder,
            chosen,
            recorded,
            evidenceOf,
        })
    }
    const slot: DataSlot<OutcomeView> = mapSlot(query.slot, viewOf)

    const submit = form.handleSubmit(async (input) => {
        if (lead === null) return
        setError(null)
        const result = await commands.recordOutcome(lead.id, input.stage ?? lead.stage, input.evidence)
        if (result === undefined) {
            setError(t("outcomeFailed"))
            return
        }
        form.reset({ stage: input.stage, evidence: "" })
    })

    return (
        <LeadOutcomeBase
            props={buildOutcomeCardView({ slot, evidence, error, form, isPending, t, stageLabel, slotLabels })}
            on={{
                stage: (value) => form.setValue("stage", isStage(value) ? value : null),
                evidence: (value) => form.setValue("evidence", value, { shouldDirty: true }),
                submit: () => {
                    void submit()
                },
            }}
        />
    )
}

/** Inputs needed to build the LeadOutcomeContent section. */
interface BuildOutcomeSummaryContext {
    readonly t: ReturnType<typeof useTranslations<"lead">>
    readonly stageLabel: (value: LeadStageId) => string
    readonly current: LeadStageId
    readonly isClosed: boolean
    readonly evidenceStep: 1 | 2
    readonly ladder: string[]
    readonly chosen: LeadStageId
    readonly recorded: EventRecord[]
    readonly evidenceOf: (event: EventRecord) => { id: string; byline: string; text: string }
}
/** Builds the LeadOutcomeContent section from the current view. */
const buildOutcomeSummary = ({
    t,
    stageLabel,
    current,
    isClosed,
    evidenceStep,
    ladder,
    chosen,
    recorded,
    evidenceOf,
}: BuildOutcomeSummaryContext) =>
    ({
        fact: t("currentStage", { stage: stageLabel(current) }),
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
        meterValue: evidenceStep - 1,
        meterMax: ladder.length,
        meterValueLabel: ladder[evidenceStep - 1] ?? "",
        evidenceNote: t("evidenceNote", { ladder: ladder.join(" → ") }),
        stage: chosen,
        wonNote: chosen === "won" ? t("wonHandoff") : null,
        recordedTitle: t("evidenceRecorded", { count: recorded.length }),
        recorded: recorded.map(evidenceOf),
    }) as const

/** Inputs needed to build the LeadOutcomeContent section. */
interface BuildOutcomeCardViewContext {
    readonly slot: DataSlot<OutcomeView>
    readonly evidence: string
    readonly error: string | null
    readonly form: ReturnType<typeof useLeadOutcomeForm>
    readonly isPending: boolean
    readonly t: ReturnType<typeof useTranslations<"lead">>
    readonly stageLabel: (value: LeadStageId) => string
    readonly slotLabels: ReturnType<typeof useSlotLabels>
}
/** Builds the LeadOutcomeContent section from the current view. */
const buildOutcomeCardView = ({
    slot,
    evidence,
    error,
    form,
    isPending,
    t,
    stageLabel,
    slotLabels,
}: BuildOutcomeCardViewContext) =>
    ({
        slot,
        evidenceText: evidence,
        error: error ?? form.formState.errors.evidence?.message ?? null,
        isPending,
        labels: {
            title: t("outcome"),
            stepperLabel: t("stageStepperLabel"),
            meterLabel: t("evidenceState"),
            stageLabel: t("fieldStage"),
            stageOptions: STAGE_ORDER.map((id) => ({ id, label: stageLabel(id) })),
            evidenceLabel: t("evidence"),
            evidenceHint: t("evidenceHint"),
            recordLabel: t("recordOutcome"),
            failTitle: t("outcomeFailed"),
            noEvidenceTitle: t("noEvidence"),
            noEvidenceHint: t("noEvidenceHint"),
            slot: slotLabels(t("noEvidence")),
        },
    }) as const
