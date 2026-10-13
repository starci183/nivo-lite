"use client"

import { useTranslations } from "next-intl"
import { useAgentSync, useSave } from "@/hooks/modules"
import { getAgentSyncStatus, resyncAgent } from "@/lib/module-settings-actions"
import { AgentSyncCardBase } from "./component"

/** The installation whose OpenClaw copy the card follows. */
type AgentSyncCardProps = {
    readonly installationId: string
}

const SECONDS_BEFORE_MINUTES = 90
const SECONDS_BEFORE_HOURS = 5400
const SECONDS_BEFORE_DAYS = 129_600

/** The connected sync card: follows the OpenClaw copy of the agent and queues a sync on request. The page leaves it out for anyone but owners and managers. */
export const AgentSyncCard = (props: AgentSyncCardProps) => {
    const t = useTranslations("modulesCore")
    const { status, isKnown, markSyncing } = useAgentSync(props.installationId, getAgentSyncStatus)
    const { note, isPending, save } = useSave()
    const ago = (iso: string): string => {
        const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000))
        if (seconds < SECONDS_BEFORE_MINUTES) return t("syncAgo", { n: seconds })
        if (seconds < SECONDS_BEFORE_HOURS) return t("syncAgoMin", { n: Math.round(seconds / 60) })
        if (seconds < SECONDS_BEFORE_DAYS) return t("syncAgoHour", { n: Math.round(seconds / 3600) })
        return t("syncAgoDay", { n: Math.round(seconds / 86_400) })
    }
    const never = t("syncNever")
    const when = status.checkedAt === null ? "" : ago(status.checkedAt)
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
            text:
                status.syncedVersion === null
                    ? t("syncOkNone", { ago: when })
                    : t("syncOk", { version: status.syncedVersion, ago: when }),
            tone: "success" as const,
        }
    })()
    return (
        <AgentSyncCardBase
            props={{
                title: t("syncTitle"),
                lineText: line.text,
                lineTone: line.tone,
                resyncLabel: t("resync"),
                isResyncDisabled: isPending || status.state === "syncing",
                isQueuing: isPending,
                help: t("syncHelp"),
                noteTone: note.tone,
                noteTitle: note.tone === "saved" ? t("saved") : t("notSaved"),
                noteText: note.text,
            }}
            on={{
                resync: () =>
                    save(async () => {
                        const queued = await resyncAgent(props.installationId)
                        if (queued.kind === "ok" && !queued.value)
                            return { kind: "unavailable", code: t("resyncFailed") }
                        if (queued.kind === "ok") markSyncing()
                        return queued
                    }, t("saved")),
            }}
        />
    )
}
