"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useQueryWorkspaceShellSwr } from "@/hooks/swr"
import { FOUNDING_OFFER } from "@/modules/promo"
import type { ConsolePending } from "@/modules/types"
import { LEADS_ROUTE, OFFICE_ROUTE } from "./console.shared"

const SUMMARY_MAX = 60

const SHELL_WINDOW = { foundingFrom: FOUNDING_OFFER.startsAt, foundingTo: FOUNDING_OFFER.endsAt } as const

const clip = (value: string): string =>
    value.length > SUMMARY_MAX ? `${value.slice(0, SUMMARY_MAX - 1).trimEnd()}…` : value

/** What the console frame draws from the back end: the real counts, the waiting approvals and the Chatbot agent. */
export interface ConsoleShellView {
    readonly pending: ReadonlyArray<ConsolePending>
    readonly pendingCount: number
    readonly chatbotAgentId: string | null
    readonly isFoundingMember: boolean
}

const EMPTY: ConsoleShellView = { pending: [], pendingCount: 0, chatbotAgentId: null, isFoundingMember: false }

/** Reads the console frame facts of a workspace (the back end `workspaceShell` query) and shapes them for the top bar and the rail. */
export const useConsoleShell = (workspaceId: string): ConsoleShellView => {
    const t = useTranslations("shell")
    const { data } = useQueryWorkspaceShellSwr(workspaceId, SHELL_WINDOW)
    return useMemo((): ConsoleShellView => {
        if (data === undefined) return EMPTY
        const approvals = data.approvals.map((approval): ConsolePending => ({
            id: approval.id,
            leadName: approval.contactName ?? t("unknownLead"),
            summary: clip(approval.nextAction || approval.draft),
            href: approval.leadId === null ? LEADS_ROUTE : `${LEADS_ROUTE}/${approval.leadId}`,
        }))
        // Exceptions with no approval card of their own (an approval card is already in the list above).
        const exceptions = data.exceptions.map((item): ConsolePending => ({
            id: `wi-${item.id}`,
            leadName: item.contactName ?? t("unknownLead"),
            summary: clip(item.summary || item.error || ""),
            href: OFFICE_ROUTE,
        }))
        return {
            pending: [...approvals, ...exceptions],
            pendingCount: data.pendingDecisions,
            chatbotAgentId: data.agents.find((agent) => agent.module === "chatbot")?.id ?? null,
            isFoundingMember: data.isFoundingMember,
        }
    }, [data, t])
}
