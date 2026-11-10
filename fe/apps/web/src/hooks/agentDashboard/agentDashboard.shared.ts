import { operatingModeOf } from "@/hooks/installations"
import type { ModuleKey } from "@/modules/catalog"
import { agentHref, type OperatingMode } from "@/modules/installations"
import { workspaceHref } from "@/modules/routes"

/** The wire line of a waiting or done region. */
interface ItemWire {
    readonly id: string
    readonly title: string
    readonly customer: string
    readonly action: string
    readonly at: string
    readonly leadId?: string | null
    readonly resultHref?: string | null
}

/** The wire answer of the back end `agentDashboard` query; a region the server could not read has `ok` false. */
interface DashboardWire {
    readonly agent?: { readonly id: string; readonly name: string; readonly mode: string } | null
    readonly waiting: {
        readonly ok: boolean
        readonly data?: { readonly total: number; readonly items: ReadonlyArray<ItemWire> } | null
    }
    readonly done: {
        readonly ok: boolean
        readonly data?: { readonly count: number; readonly items: ReadonlyArray<ItemWire> } | null
    }
    readonly knowledge: {
        readonly ok: boolean
        readonly data?: {
            readonly audience: string
            readonly documents: { readonly public: number; readonly internal: number }
            readonly facts: { readonly public: number; readonly internal: number; readonly restricted: number }
            readonly gaps?: {
                readonly openCount: number
                readonly items: ReadonlyArray<{
                    readonly id: string
                    readonly question: string
                    readonly count: number
                    readonly lastSeenAt: string
                }>
            } | null
        } | null
    }
}

/** One line of a list region: a decision waiting, or something the agent finished. */
export interface DashboardRow {
    readonly id: string
    readonly title: string
    /** Who it is about, may be empty. */
    readonly customer: string
    /** The action key, worded by the reader (governance catalog). */
    readonly action: string
    readonly at: string | null
    /** Where the row leads: the decision itself, or the evidence. */
    readonly href: string
}

/** What the agent can read (its lens) and, when the reader may see it, the open gaps. */
interface DashboardKnowledge {
    readonly audience: "customer" | "internal"
    readonly documents: { readonly public: number; readonly internal: number }
    readonly facts: { readonly public: number; readonly internal: number; readonly restricted: number }
    readonly gaps: {
        readonly openCount: number
        readonly items: ReadonlyArray<{
            readonly id: string
            readonly question: string
            readonly count: number
            readonly lastSeenAt: string
        }>
    } | null
}

/** Everything the common regions of an agent workbench need; a region the server could not read has `isFailed` and empty data. */
export interface AgentDashboardView {
    /** null when the module has no agent yet. */
    readonly agent: { readonly id: string; readonly name: string; readonly mode: OperatingMode } | null
    readonly waiting: {
        readonly isFailed: boolean
        readonly total: number
        readonly items: ReadonlyArray<DashboardRow>
    }
    readonly done: { readonly isFailed: boolean; readonly count: number; readonly items: ReadonlyArray<DashboardRow> }
    readonly knowledge: { readonly isFailed: boolean } & DashboardKnowledge
}

/** The view before the dashboard is read: nothing is failed and nothing is counted (the screens draw a skeleton meanwhile). */
export const PENDING_DASHBOARD: AgentDashboardView = {
    agent: null,
    waiting: { isFailed: false, total: 0, items: [] },
    done: { isFailed: false, count: 0, items: [] },
    knowledge: {
        isFailed: false,
        audience: "customer",
        documents: { public: 0, internal: 0 },
        facts: { public: 0, internal: 0, restricted: 0 },
        gaps: null,
    },
}

/** The dashboard of a module as the screens read it. Waiting rows lead to the module workbench focused on the item. */
export const toAgentDashboard = (
    data: DashboardWire,
    module: ModuleKey,
    installationId: string | null,
    workspaceId: string,
): AgentDashboardView => {
    const waitingRow = (item: ItemWire): DashboardRow => ({
        id: item.id,
        title: item.title,
        customer: item.customer,
        action: item.action,
        at: item.at === "" ? null : item.at,
        href: workspaceHref(
            workspaceId,
            agentHref(module, installationId, "workbench", `focus=${encodeURIComponent(item.id)}`),
        ),
    })
    const doneRow = (item: ItemWire): DashboardRow => ({
        ...waitingRow(item),
        ...(item.resultHref ? { href: workspaceHref(workspaceId, item.resultHref) } : {}),
    })
    const waiting = data.waiting.data
    const done = data.done.data
    const knowledge = data.knowledge.data
    return {
        agent: data.agent ? { id: data.agent.id, name: data.agent.name, mode: operatingModeOf(data.agent.mode) } : null,
        waiting: {
            isFailed: !data.waiting.ok,
            total: waiting?.total ?? 0,
            items: (waiting?.items ?? []).map((item) => waitingRow(item)),
        },
        done: {
            isFailed: !data.done.ok,
            count: done?.count ?? 0,
            items: (done?.items ?? []).map((item) => doneRow(item)),
        },
        knowledge: {
            isFailed: !data.knowledge.ok,
            audience: knowledge?.audience === "internal" ? "internal" : "customer",
            documents: knowledge?.documents ?? PENDING_DASHBOARD.knowledge.documents,
            facts: knowledge?.facts ?? PENDING_DASHBOARD.knowledge.facts,
            gaps: knowledge?.gaps ?? null,
        },
    }
}
