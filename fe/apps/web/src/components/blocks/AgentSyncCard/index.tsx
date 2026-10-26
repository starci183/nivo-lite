"use client"

import { useLocale, useTranslations } from "next-intl"
import { useAgentRights, useAgentSync } from "@/hooks/agentSettings"
import { AgentSyncCardBase } from "./component"

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
    const never = t("syncNever")
    const when = status.checkedAt === null ? "" : "{time}"
    const line = (() => {
        if (!isKnown) return { text: "…", tone: "neutral" as const }
        if (status.state === "syncing") return { text: t("syncing"), tone: "neutral" as const }
        if (status.state === "none") return { text: t("syncNone"), tone: "warning" as const }
        if (status.state === "error") {
            return { text: t("syncError", { reason: status.error ?? "?" }), tone: "danger" as const }
        }
        if (status.syncedVersion !== status.activeVersion) {
            return {
                text: t("syncDrift", { active: status.activeVersion ?? never, synced: status.syncedVersion ?? never }),
                tone: "warning" as const,
            }
        }
        return {
            checkedAt: status.checkedAt,
            text:
                status.syncedVersion === null
                    ? t("syncOkNone", { ago: when })
                    : t("syncOk", { version: status.syncedVersion, ago: when }),
            tone: "success" as const,
        }
    })()
    if (!canEdit) return null
    return (
        <AgentSyncCardBase
            props={{
                title: t("syncTitle"),
                lineText: line.text,
                lineCheckedAt: "checkedAt" in line ? line.checkedAt : null,
                locale,
                lineTone: line.tone,
                resyncLabel: t("resync"),
                isResyncDisabled: isQueuing || status.state === "syncing",
                isQueuing,
                help: t("syncHelp"),
            }}
            on={{ resync: () => void resync() }}
        />
    )
}
