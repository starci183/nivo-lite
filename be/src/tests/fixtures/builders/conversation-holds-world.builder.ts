import { FakeClock, mock } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { Mutation } from "@nivo-lite/agent-sdk/mutation"
import type { Query } from "@nivo-lite/agent-sdk/query"
import type { WorkflowWorld } from "./workflow-world.builder"
import type { NodeRow } from "@modules/domain/graph-nodes"
import { pageOf } from "./agent-graph-records.builder"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import type { ScopedTx, ScopedWork } from "@modules/domain/entity-engine"
import { AgentWakeService } from "@modules/domain/agent-work"
import type { AgentWake } from "@modules/domain/agent-work"
import { AgentGraphsService } from "@modules/domain/agent-graphs"
import type { Logger } from "@modules/platform/logging"
import { AgentGraphConversationHoldsService } from "../../../modules/domain/agent-graphs/agent-graph-conversation-holds.service"

/** The Sales agent that owns the shop's Zalo channel and so keeps the conversations of its open consults. */
const HOLDER = "sales-zalo-agent"

/** The conversations the Sales consult keeps between turns, as the engine's hold rule keeps them, in memory and shared by the runs of a shop. */
export interface ConversationHoldsWorld {
    /** The wakes a customer's line sent on to the keeper wrote, in order. */
    readonly redirected: Array<AgentWake>
    /** The real hold service over the in-memory hold records, reading the graphs it is given. */
    readonly serviceOver: (graphs: AgentGraphsService, workflows?: WorkflowWorld) => AgentGraphConversationHoldsService
}

/** A customer whose lead is mid-consult in the store already has the consult keeping their conversation, for the Sales agent that owns it. */
const seededHoldsOf = (store: Record<string, Array<NodeRow>>): ReadonlyArray<RecordRow> => {
    const open = new Set((store["sales-lead"] ?? []).filter((lead) => typeof lead.consultStage === "string").map((lead) => lead.id))
    return (store.conversation ?? [])
        .filter((conversation) => open.has(conversation.leadId))
        .map((conversation) => ({
            id: textOf(conversation.id),
            workspaceId: "ws-1",
            version: "1",
            createdAt: "",
            updatedAt: "",
            data: {
                conversationId: conversation.id,
                agentId: HOLDER,
                runId: "run-before",
                heldAt: "2026-11-04T09:00:00.000Z",
            },
        }))
}

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

/** The hold records of a shop, behind the real `AgentGraphConversationHoldsService`; the tests pass its graphs in. */
export const conversationHoldsWorldOf = (store: Record<string, Array<NodeRow>> = {}): ConversationHoldsWorld => {
    const rows = new Map<string, RecordRow>(seededHoldsOf(store).map((row) => [row.id, row]))
    const redirected: Array<AgentWake> = []
    const clock = new FakeClock("2026-11-04T10:00:00.000Z")
    const tx = mock<ScopedTx>({ workspaceId: "ws-1" })
    const engine = mock<EntityEngineService>({
        scoped: <T>(_workspace: string, work: ScopedWork<T>) => work(tx),
        list: (_tx: ScopedTx, query: Query) => {
            const wanted = query.where?.op === "eq" ? query.where.value : null
            const found = [...rows.values()].filter((row) => row.data.conversationId === wanted)
            return Promise.resolve(pageOf(found.slice(0, 1)))
        },
    })
    const mutations = mock<EntityMutationService>({
        mutate: (_tx: ScopedTx, mutation: Mutation) => {
            if (mutation.op === "upsert") {
                const key = textOf(mutation.values.conversationId)
                const row: RecordRow = {
                    id: key,
                    workspaceId: "ws-1",
                    version: "1",
                    createdAt: "",
                    updatedAt: "",
                    data: { ...mutation.values },
                }
                rows.set(key, row)
                return Promise.resolve({ ok: true, row, version: "1", created: true })
            }
            if (mutation.op === "delete") rows.delete(mutation.key)
            return Promise.resolve({ ok: false, reason: "invalid" })
        },
    })
    const wakes = mock<AgentWakeService>({
        write: (_tx: EntityManager, wake: AgentWake) => {
            redirected.push(wake)
            return Promise.resolve(`wake-held-${redirected.length}`)
        },
    })
    const manager = { transaction: <T>(work: (tx: object) => Promise<T>) => work({}) }
    const serviceOver = (graphs: AgentGraphsService, workflows?: WorkflowWorld): AgentGraphConversationHoldsService =>
        new AgentGraphConversationHoldsService(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- a transaction runner stands for the manager
            manager as unknown as EntityManager,
            clock,
            mock<Logger>(),
            engine,
            mutations,
            wakes,
            graphs,
            workflows?.service,
        )
    return { redirected, serviceOver }
}
