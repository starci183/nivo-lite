"use client"

import type { ModuleIconName } from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"
import { useFormatter, useTranslations } from "next-intl"
import { MODULE_REGISTRY } from "@/modules/catalog"
import type { AgentRecord, ResponsibilityRecord } from "@/modules/types"
import { daysUntil, STATUS_KEYS, STATUS_TONES } from "./leads.shared"

/** The step being worked on, every word already resolved. */
export interface CurrentStepView {
    readonly title: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly nextAction: string
    readonly ownerName: string
    readonly ownerKindText: string
    readonly due: { readonly date: string; readonly relative: string; readonly isOverdue: boolean } | null
    readonly isDone: boolean
    readonly isAgent: boolean
    /** The semantic Icon name used when the owner is an agent. */
    readonly agentGlyph: ModuleIconName
}

/** Words one step of a lead: its status, its owner and how far its due date is, in the reader language. */
export const useStepView = (agents: ReadonlyArray<AgentRecord>): ((step: ResponsibilityRecord) => CurrentStepView) => {
    const t = useTranslations("lead")
    const format = useFormatter()
    const dueOf = (dueAt: string | null): CurrentStepView["due"] => {
        const days = daysUntil(dueAt, new Date())
        if (dueAt === null || days === null) return null
        const plural = (count: number): string => (count === 1 ? t("dayOne") : t("dayMany", { count }))
        const date = format.dateTime(new Date(dueAt), { dateStyle: "medium" })
        if (days === 0) return { date, relative: t("dueToday"), isOverdue: false }
        if (days > 0) return { date, relative: t("dueIn", { days: plural(days) }), isOverdue: false }
        return { date, relative: t("overdueBy", { days: plural(-days) }), isOverdue: true }
    }
    const ownerNameOf = (step: ResponsibilityRecord): string => {
        if (step.owner_kind !== "agent") return step.owner_name
        const handle = agents.find((agent) => agent.id === step.owner_agent_id)?.handle ?? step.owner_name
        return `@${handle.replace(/^@/, "")}`
    }
    return (step) => {
        const isAgent = step.owner_kind === "agent"
        return {
            title: step.title,
            statusLabel: t(STATUS_KEYS[step.status]),
            statusTone: STATUS_TONES[step.status],
            nextAction: step.next_action,
            ownerName: ownerNameOf(step),
            ownerKindText: `${isAgent ? t("aiAgent") : t("human")} \u00b7 ${t("accountable")}`,
            due: dueOf(step.due_at),
            isDone: step.status === "done",
            isAgent,
            agentGlyph: MODULE_REGISTRY.chatbot.glyph,
        }
    }
}
