"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { ageOf, STAGE_KEYS, STAGE_ORDER, useLeadCommands } from "@/hooks/leads"
import { faultTextOf, isEvidenceEvent } from "@/hooks/leadJourney"
import { loadingSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import type { EventRecord, LeadJourney, LeadStageId, DataSlot } from "@/modules/types"
import { LeadOutcomeBase } from "./component"
import type { OutcomeView } from "./component"

/** The lead the card acts on and its workspace; a null detail draws the loading card. */
interface LeadOutcomeProps {
    readonly detail: LeadJourney | null
    readonly workspaceId: string
}

const isStage = (value: string): value is LeadStageId => STAGE_ORDER.some((stage) => stage === value)

/** The outcome card: the stage choice and the evidence text live here, the drawing in the pure half. */
export const LeadOutcome = (props: LeadOutcomeProps) => {
    const t = useTranslations("lead")
    const tl = useTranslations("leads")
    const slotLabels = useSlotLabels()
    const format = useFormatter()
    const router = navigation.useRouter()
    const commands = useLeadCommands(props.workspaceId)
    const [isPending, startTransition] = useTransition()
    const detail = props.detail
    const [stage, setStage] = useState<LeadStageId | null>(null)
    const [evidence, setEvidence] = useState("")
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
        return {
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
        }
    }
    const slot: DataSlot<OutcomeView> = detail === null ? loadingSlot() : { items: viewOf(detail) }

    const submit = () => {
        if (lead === null) return
        setError(null)
        startTransition(async () => {
            const result = await commands.recordOutcome(lead.id, stage ?? lead.stage, evidence.trim())
            if (result.kind !== "ok") {
                setError(faultTextOf(result))
                return
            }
            setEvidence("")
            router.refresh()
        })
    }

    return (
        <LeadOutcomeBase
            props={{
                slot,
                evidenceText: evidence,
                error,
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
            }}
            on={{
                stage: (value) => setStage(isStage(value) ? value : null),
                evidence: setEvidence,
                submit,
            }}
        />
    )
}
