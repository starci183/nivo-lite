"use client"

import type { ModuleKey } from "@/hooks/installations"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { maskPhones } from "@/modules/utils"
import { useFormatter, useTranslations } from "next-intl"
import { PENDING_DASHBOARD, type AgentDashboardView, type DashboardRow } from "./agentDashboard.shared"
import { useAgentDashboardConnections } from "./useAgentDashboardConnections"
import { useAgentDashboardKnowledge, type KnowledgeBody } from "./useAgentDashboardKnowledge"
import { actionWordOf } from "@/hooks/actionWord"
import type { BadgeTone } from "@starci/grammar/common"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the regions need from the frame: the module, and whether the module brings its own gaps card. */
interface RegionsInput {
    readonly module: ModuleKey
    readonly hasOwnGaps: boolean
}

/** A blank list row: the placeholder of a region draws the same row as a ready one, as a skeleton. */
const PLACEHOLDER_ROW = { id: "placeholder", title: "-", description: "-", href: "" }

/** A row without a readable time shows no time: the formatter never sees an invalid date. */
const whenOfFormat =
    (format: ReturnType<typeof useFormatter>) =>
    (iso: string | null): string => {
        const at = iso === null ? Number.NaN : Date.parse(iso)
        return Number.isNaN(at)
            ? ""
            : format.dateTime(new Date(at), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    }

/**
 * The slot of one region of the dashboard: loading and failing with the whole read, failing alone when the server could not read
 * this region, else its view. A read that does not fetch stays as it is (empty).
 */
const regionSlotOf = <V>(
    slot: DataSlot<AgentDashboardView>,
    isRegionFailed: (dashboard: AgentDashboardView) => boolean,
    viewOf: (dashboard: AgentDashboardView) => V,
): DataSlot<V> => {
    if (!("items" in slot)) return slot
    return isRegionFailed(slot.items) ? { isError: true } : mapSlot(slot, viewOf)
}

/** One row of the lists of waiting and done decisions. */
interface DashboardListRow {
    id: string
    title: string
    description: string
    href: string
}

/** What every list region says when it has nothing to list. */
interface EmptyWords {
    emptyMessage: string
    emptyDescription: string
}

/** The body of the waiting region. */
interface WaitingBody extends EmptyWords {
    count: string | null
    rows: DashboardListRow[]
    openLabel: string
    more: string | null
}

/** The body of the done region. */
interface DoneBody extends EmptyWords {
    count: string
    logLabel: string
    logHref: string
    rows: DashboardListRow[]
}

/** One connection row as the region draws it. */
interface ConnectionRowView {
    id: string
    name: string
    description: string
    statusLabel: string
    statusTone: BadgeTone
    accessLabel: string
}

/** The blank row that stands for a connection while the read is pending. */
interface BlankConnectionRow extends DashboardListRow {
    name: string
    statusLabel: string
    statusTone: "neutral"
    accessLabel: string
}

/** The body of the connections region. */
interface ConnectionsBody extends EmptyWords {
    summary: string
    manageLabel: string
    manageHref: string
    rows: ConnectionRowView[]
}

/** One region: its title, its slot, the same-shape placeholder and the words of its status. */
interface DashboardRegion<Body, Placeholder = Body> {
    label: string
    slot: DataSlot<Body>
    placeholder: Placeholder
    labels: SlotLabels
}

/** The view `useAgentDashboardRegions` returns. */
export interface AgentDashboardRegionsView {
    waiting: DashboardRegion<WaitingBody, Omit<WaitingBody, "count"> & { count: string }>
    done: DashboardRegion<DoneBody>
    connections: DashboardRegion<ConnectionsBody, Omit<ConnectionsBody, "rows"> & { rows: BlankConnectionRow[] }>
    knowledge: DashboardRegion<KnowledgeBody>
}

/** The four common regions of an agent workbench (waiting, done, connections, knowledge): each one a slot, its same-shape placeholder and the words of its status. */
export const useAgentDashboardRegions = (
    slot: DataSlot<AgentDashboardView>,
    input: RegionsInput,
): AgentDashboardRegionsView => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("agentDashboard")
    const g = useTranslations("governance")
    const slotLabels = useSlotLabels()
    const whenOf = whenOfFormat(useFormatter())
    const connections = useAgentDashboardConnections("items" in slot ? slot.items : PENDING_DASHBOARD)
    const actionOf = (action: string): string => actionWordOf(g, action)
    const rowOf = (item: DashboardRow) => ({
        id: item.id,
        title: maskPhones(item.title),
        description: [item.customer, actionOf(item.action), whenOf(item.at)].filter(Boolean).join(" · "),
        href: item.href,
    })
    const waitingOf = (dashboard: AgentDashboardView) => ({
        count: dashboard.waiting.total > 0 ? String(dashboard.waiting.total) : null,
        rows: dashboard.waiting.items.map((item) => rowOf(item)),
        openLabel: t("waitingOpen"),
        more:
            dashboard.waiting.total > dashboard.waiting.items.length
                ? t("waitingMore", { n: dashboard.waiting.total - dashboard.waiting.items.length })
                : null,
        emptyMessage: t("waitingEmpty"),
        emptyDescription: t("waitingEmptyBody"),
    })
    const doneOf = (dashboard: AgentDashboardView) => ({
        count: t("doneCount", { n: dashboard.done.count }),
        logLabel: t("doneLog"),
        logHref: workspaceHref(workspaceId, CONSOLE_ROUTES.inbox),
        rows: dashboard.done.items.map((item) => rowOf(item)),
        emptyMessage: t("doneEmpty"),
        emptyDescription: t("doneEmptyBody"),
    })
    const knowledgeViewOf = useAgentDashboardKnowledge(input.hasOwnGaps, whenOf)
    const blankConnection = {
        ...PLACEHOLDER_ROW,
        name: "-",
        statusLabel: "-",
        statusTone: "neutral" as const,
        accessLabel: "-",
    }
    return {
        waiting: {
            label: t("waitingTitle"),
            slot: regionSlotOf(slot, (dashboard) => dashboard.waiting.isFailed, waitingOf),
            placeholder: { ...waitingOf(PENDING_DASHBOARD), count: "0", rows: [PLACEHOLDER_ROW] },
            labels: slotLabels(t("waitingEmpty")),
        },
        done: {
            label: t("doneTitle"),
            slot: regionSlotOf(slot, (dashboard) => dashboard.done.isFailed, doneOf),
            placeholder: { ...doneOf(PENDING_DASHBOARD), rows: [PLACEHOLDER_ROW] },
            labels: slotLabels(t("doneEmpty")),
        },
        connections: {
            label: t("connTitle"),
            slot: regionSlotOf(
                slot,
                (dashboard) => dashboard.connections.isFailed,
                () => connections,
            ),
            placeholder: { ...connections, rows: [blankConnection] },
            labels: slotLabels(t("connEmpty")),
        },
        knowledge: {
            label: t("knowTitle"),
            slot: regionSlotOf(slot, (dashboard) => dashboard.knowledge.isFailed, knowledgeViewOf),
            placeholder: knowledgeViewOf(PENDING_DASHBOARD),
            labels: slotLabels(t("knowTitle")),
        },
    }
}
