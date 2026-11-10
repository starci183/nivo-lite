"use client"

import { useLocale, useTranslations } from "next-intl"
import { useAgentRights, useAgentSync } from "@/hooks/agentSettings"
import { AgentSyncCardBase } from "./component"

/** The failures of a sync the words name; any other code reads as the generic line, never as the raw code. */
const SYNC_REASON_KEYS: Readonly<Record<string, string>> = {
    WORKSPACE_UNAVAILABLE: "syncReasonWorkspaceUnavailable",
}

/** The words for a sync failure code. */
const reasonKeyOf = (code: string | null): string =>
    Object.entries(SYNC_REASON_KEYS).find(([known]) => code?.endsWith(known) === true)?.[1] ?? "syncReasonUnknown"

/** The installation whose OpenClaw copy the card follows. */
type AgentSyncCardProps = {
    readonly installationId: string
}

/** The connected sync card: follows the OpenClaw copy of the agent and queues a sync on request. The page leaves it out for anyone but owners and managers. */
export const AgentSyncCard = (props: AgentSyncCardProps) => {
    const t = useTranslations("modulesCore")
    const locale = useLocale()
    const { canEdit } = useAgentRights()
    const { status, isKnown, resync, isQueuing } = useAgentSync(props.installationId)
    const tg = useTranslations("agentGeneral")
    const never = t("syncNever")
    const line = (() => {
        if (!isKnown) return { text: "...", at: null }
        if (status.state === "syncing") return { text: t("syncing"), at: null }
        if (status.state === "none") return { text: t("syncNone"), at: null }
        if (status.state === "error") return { text: t("syncError", { reason: t(reasonKeyOf(status.error)) }), at: null }
        if (status.syncedVersion !== status.activeVersion) {
            return {
                text: t("syncDrift", { active: status.activeVersion ?? never, synced: status.syncedVersion ?? never }),
                at: status.checkedAt,
            }
        }
        if (status.syncedVersion === null) return { text: tg("syncNoVersion"), at: status.checkedAt }
        return { text: tg("syncVersion", { version: status.syncedVersion }), at: status.checkedAt }
    })()
    if (!canEdit) return null
    return (
        <AgentSyncCardBase
            props={{
                title: tg("syncRowTitle"),
                lead: line.text,
                checkedAt: line.at,
                checkedTemplate: String(tg.raw("syncAgo")),
                autoNote: tg("syncAuto"),
                locale,
                resyncLabel: t("resync"),
                isResyncDisabled: isQueuing || status.state === "syncing",
                isQueuing,
            }}
            on={{ resync: () => void resync() }}
        />
    )
}
