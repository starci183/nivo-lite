import { fakeTransaction, FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { coreDataKinds, coreEffects, coreNodes, coreTools } from "@nivo-lite/blocks-core"
import { AgentGraphFreezeGateService, AgentGraphsService } from "@modules/domain/agent-graphs"
import type { FlowTriggerMessages } from "@modules/domain/agent-graphs"
import { AgentRunRecoveryService, AgentRunsService } from "@modules/domain/agent-runs"
import type { RunView, StepSpec } from "@modules/domain/agent-runs"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkSpec } from "@modules/domain/decisions"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeRow } from "@modules/domain/graph-nodes"
import {
    LeadFreezeItemsService,
    LeadFreezeRecordsService,
    LeadFreezeRunsService,
    LeadFreezeWakesService,
    LeadFreezesService,
} from "@modules/domain/lead-freezes"
import type { FreezeBuild, FreezeSubject, FreezeValues, LeadFreeze, PendingEvent } from "@modules/domain/lead-freezes"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkItemsService } from "@modules/domain/work-items"
import type { Logger } from "@modules/platform/logging"
import { runViewOf, stepViewOf } from "./agent-runs.builder"
import { advance, doorOf, playedOf, shopOf } from "./demo-flow-shop.builder"
import type { Played, Progress, Seat, Shop, Store } from "./demo-flow-shop.builder"
import { NO_FLOW, flowServicesOf } from "./flow-f-world.builder"
import type { FlowServices } from "./flow-f-world.builder"
import type { ModuleName } from "./workflow-world.builder"
import { freezeCatalog, releasedFreezeOf } from "./lead-freezes.builder"
import { itemOf } from "./work-decision.builder"

/** A run of the shop that failed for good, as the fake engine keeps it to tell the freeze and to run it again from its failed step. */
export interface StoppedPlay {
    /** The run. */
    readonly runId: string
    /** Its agent. */
    readonly agentId: string
    /** The module whose workflows the agent runs. */
    readonly module: ModuleName
    /** The step it failed on, with the input it ran with. */
    readonly failed: StepSpec
    /** Why it failed. */
    readonly code: string
    /** The wake's context. */
    readonly context: Readonly<Record<string, unknown>>
    /** Where it stands: parked until a retry ends it, dead when the owner skipped it. */
    status: RunView["status"]
    /** Whether the owner holds it (off the machine's resume passes). */
    held: boolean
}

/** Runs a stopped run again from its failed step with `input`, the way the engine's resume does; answers where the run stands after. */
export type ResumePlay = (stopped: StoppedPlay, input: Readonly<Record<string, unknown>>) => Promise<RunView["status"]>

/** The freezes of the shop: the real service over in-memory records, items and wakes, and the fake engine's runs. */
export interface ShopFreezes {
    /** The gate the flows ask. */
    readonly gate: AgentGraphFreezeGateService
    /** The freezes. */
    readonly service: LeadFreezesService
    /** The freeze records. */
    readonly records: Map<string, LeadFreeze>
    /** The runs that failed for good, by id. */
    readonly stopped: Map<string, StoppedPlay>
    /** The events written again as wakes on a release, in order. */
    readonly replayed: Array<PendingEvent>
    /** Who took a conversation over, by conversation. */
    readonly heldBy: Map<string, string>
    /** Ends a run that failed for good as the engine does: parked, its dead letter told (the holding line, the freeze). */
    readonly stop: (
        services: FlowServices,
        seat: Seat,
        runId: string,
        context: Readonly<Record<string, unknown>>,
        done: Progress,
    ) => Promise<void>
}

/** The rows of a data kind of a store. */
const rowsOf = (store: Record<string, Array<NodeRow>>, kind: string): Array<NodeRow> => (store[kind] ??= [])

const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

/** Letters and digits of a text, upper case: how a transfer names its order's code. */
const codeOf = (text: string): string => text.replace(/[^A-Za-z0-9]/g, "").toUpperCase()

/** A new freeze record with nothing in it. */
const blankFreeze = (id: string, subject: FreezeSubject): LeadFreeze => releasedFreezeOf({ id, ...subject })

/** The records of the freezes in memory, with the reads of the shop's conversation, lead, transfers and orders. */
const recordsOf = (
    store: Record<string, Array<NodeRow>>,
    records: Map<string, LeadFreeze>,
): LeadFreezeRecordsService => {
    const find = (match: (freeze: LeadFreeze) => boolean): LeadFreeze | null =>
        [...records.values()].find(match) ?? null
    const patch = (_ws: string, id: string, build: FreezeBuild): Promise<LeadFreeze | null> => {
        const freeze = records.get(id)
        if (freeze === undefined) return Promise.reject(new Error(`no freeze ${id}`))
        const values: FreezeValues | null = build(freeze)
        if (values === null) return Promise.resolve(null)
        const next: LeadFreeze = { ...freeze, ...values, version: String(Number(freeze.version) + 1) }
        records.set(id, next)
        return Promise.resolve(next)
    }
    return mock<LeadFreezeRecordsService>({
        byKey: (_ws: string, key: string) => Promise.resolve(find((freeze) => freeze.key === key)),
        byRun: (_ws: string, runId: string) => Promise.resolve(find((freeze) => freeze.frozenRunId === runId)),
        byLead: (_ws: string, leadId: string) => Promise.resolve(find((freeze) => freeze.leadId === leadId)),
        byId: (_ws: string, id: string) => Promise.resolve(records.get(id) ?? null),
        holding: () => Promise.resolve([...records.values()].filter((freeze) => freeze.status !== "released")),
        ensure: (_ws: string, subject: FreezeSubject) => {
            const found = find((freeze) => freeze.key === subject.key)
            if (found !== null) return Promise.resolve(found)
            const made = blankFreeze(`freeze-${records.size + 1}`, subject)
            records.set(made.id, made)
            return Promise.resolve(made)
        },
        patch,
        leadOfConversation: (_ws: string, conversationId: string) =>
            Promise.resolve(textOf(rowsOf(store, "conversation").find((row) => row.id === conversationId)?.leadId)),
        nameOfLead: (_ws: string, leadId: string) =>
            Promise.resolve(textOf(rowsOf(store, "sales-lead").find((row) => row.id === leadId)?.contactName)),
        leadOfTransaction: (_ws: string, transactionId: string, holding: ReadonlyArray<LeadFreeze>) => {
            const reference = codeOf(
                textOf(rowsOf(store, "bank-transaction").find((row) => row.id === transactionId)?.reference) ?? "",
            )
            const owner = holding.find((freeze) =>
                rowsOf(store, "order")
                    .filter((order) => order.leadId === freeze.leadId)
                    .some((order) => reference !== "" && reference.includes(codeOf(textOf(order.orderNo) ?? "-"))),
            )
            return Promise.resolve(owner ?? null)
        },
    })
}

/** The owner's items of the freezes, through the real items capability over a work engine that keeps them as rows of `work-item`. */
const itemsOf = (store: Record<string, Array<NodeRow>>): LeadFreezeItemsService => {
    const rows = rowsOf(store, "work-item")
    const engine = mock<WorkEngineService>({
        runWork: (_ctx: unknown, spec: WorkSpec) => {
            const id = `item-${rows.length + 1}`
            rows.push({
                id,
                action: spec.action,
                status: "waiting_decision",
                leadId: spec.lead_id ?? null,
                summary: spec.seed?.summary ?? "",
                payload: { ...spec.seed?.fields },
            })
            return Promise.resolve(itemOf({ id, action: spec.action }))
        },
    })
    const items = mock<WorkItemsService>({
        findMany: (ids: ReadonlyArray<string>) =>
            Promise.resolve(
                rows
                    .filter((row) => ids.includes(String(row.id)))
                    .map((row) =>
                        itemOf({
                            id: String(row.id),
                            status: row.status === "waiting_decision" ? "waiting_decision" : "done",
                        }),
                    ),
            ),
        markStillWaiting: (id: string, still: Parameters<WorkItemsService["markStillWaiting"]>[1]) => {
            const row = rows.find((each) => each.id === id)
            if (row !== undefined) Object.assign(row, { summary: still.proposal.summary })
            return Promise.resolve()
        },
    })
    const installations = mock<InstallationRecordsService>({ ofAgent: () => Promise.resolve(null) })
    return new LeadFreezeItemsService(engine, items, installations, freezeCatalog)
}

/** The runs as the freezes read them: the real runs capability over a run engine that keeps the shop's stopped runs. */
const runsOf = (
    stopped: Map<string, StoppedPlay>,
    resume: ResumePlay,
    gate: AgentGraphFreezeGateService,
    workflows: ReadonlyMap<string, GraphSpec>,
): LeadFreezeRunsService => {
    const runs = mock<AgentRunsService>({
        runOf: (_ws: string, runId: string) => {
            const play = stopped.get(runId)
            return Promise.resolve(
                play === undefined
                    ? null
                    : runViewOf({
                          id: runId,
                          agentId: play.agentId,
                          status: play.status,
                          context: { ...play.context },
                      }),
            )
        },
        advance: (_ws: string, runId: string) =>
            Promise.resolve({
                run: runViewOf({ id: runId, status: stopped.get(runId)?.status ?? "parked" }),
                retryAfterMs: null,
            }),
    })
    const recovery = mock<AgentRunRecoveryService>({
        failedStepOf: (_ws: string, runId: string) => {
            const play = stopped.get(runId)
            if (play === undefined) return Promise.resolve(null)
            const { stepKey, nodeKey, kind, input } = play.failed
            return Promise.resolve({ stepKey, nodeKey, kind, errorCode: play.code, input })
        },
        keep: (_ws: string, runId: string) => {
            const play = stopped.get(runId)
            if (play !== undefined) play.held = true
            return Promise.resolve(play !== undefined)
        },
        retry: async (request: Parameters<AgentRunRecoveryService["retry"]>[0]) => {
            const play = stopped.get(request.runId)
            if (play === undefined) return { kind: "not_found" as const }
            const input = request.input === undefined ? play.failed.input : await request.input(play.failed.input)
            play.status = await resume(play, input)
            return { kind: "resumed" as const, stepKey: play.failed.stepKey, workspaceId: request.workspaceId }
        },
        abandon: (_ws: string, runId: string) => {
            const play = stopped.get(runId)
            if (play !== undefined) play.status = "dead"
            return Promise.resolve(play === undefined ? ("not_held" as const) : ("abandoned" as const))
        },
    })
    const graphs = mock<AgentGraphsService>({
        documentOf: (_ws: string, _agentId: string, versionId: string) =>
            Promise.resolve({ nodes: [], rights: [], flow: workflows.get(versionId) }),
    })
    const index = nodeIndexOf({ nodes: coreNodes, effects: coreEffects, tools: coreTools, dataKinds: coreDataKinds })
    const nodes = mock<GraphNodeRegistryService>({ installed: () => index })
    return new LeadFreezeRunsService(mock<Logger>(), runs, recovery, graphs, nodes, gate)
}

/** The wakes the freezes write again on a release, and the take-over of a conversation, captured. */
const wakesOf = (replayed: Array<PendingEvent>, heldBy: Map<string, string>): LeadFreezeWakesService =>
    mock<LeadFreezeWakesService>({
        replay: (_tx: EntityManager, _ws: string, _freeze: LeadFreeze, events: ReadonlyArray<PendingEvent>) => {
            replayed.push(...events)
            return Promise.resolve(events.length)
        },
        takeOver: (_ws: string, conversationId: string, holder: string) => {
            heldBy.set(conversationId, holder)
            return Promise.resolve()
        },
    })

/** The freezes of a shop: the real service and gate over the shop's store and the fake engine's runs. */
export const shopFreezesOf = (
    store: Record<string, Array<NodeRow>>,
    resume: ResumePlay,
    lines: FlowTriggerMessages,
    workflows: ReadonlyMap<string, GraphSpec>,
): ShopFreezes => {
    const gate = new AgentGraphFreezeGateService(lines)
    const records = new Map<string, LeadFreeze>()
    const stopped = new Map<string, StoppedPlay>()
    const replayed: Array<PendingEvent> = []
    const heldBy = new Map<string, string>()
    const entityManager = fakeTransaction(mockEntityManager()).em
    const service = new LeadFreezesService(
        entityManager,
        new FakeClock("2026-11-04T10:10:00.000Z"),
        mock<Logger>(),
        gate,
        recordsOf(store, records),
        itemsOf(store),
        runsOf(stopped, resume, gate, workflows),
        wakesOf(replayed, heldBy),
    )
    service.onModuleInit()
    const stop = async (
        services: FlowServices,
        seat: Seat,
        runId: string,
        context: Readonly<Record<string, unknown>>,
        done: Progress,
    ) => {
        const spec = done.failedSpec
        if (spec === null) return
        const play: StoppedPlay = {
            runId,
            agentId: seat.id,
            module: seat.module,
            failed: spec,
            code: done.code ?? "agent_runs_handler_threw",
            context,
            status: "parked",
            held: false,
        }
        stopped.set(runId, play)
        const view = stepViewOf({
            ...spec,
            runId,
            agentId: seat.id,
            earlier: { ...done.earlier },
            result: null,
            status: "failed",
        })
        await services.steps.deadLetter(view, play.code)
    }
    return { gate, service, records, stopped, replayed, heldBy, stop }
}

/**
 * Runs a stopped run again from its failed step with `input`, the way the engine's resume does: the done steps keep their results, the
 * failed one runs with the input the retry read afresh. Answers where the run stands after.
 */
const resumeOf =
    (shop: Shop, retried: Array<Played>): ResumePlay =>
    async (stopped, input) => {
        const memo = shop.memos.get(stopped.runId)
        const spec = memo?.progress.failedSpec
        if (memo === undefined || spec === undefined || spec === null) return "parked"
        const services = await flowServicesOf(shop.world, NO_FLOW, memo.model, doorOf(shop), {
            workflows: shop.workflows,
            memory: shop.memory,
            holds: shop.holds,
            ledger: shop.ledger,
        })
        const from: Progress = { ...memo.progress, failed: null, error: null, code: null, failedSpec: null }
        const queue = [{ ...spec, input }]
        const done = await advance(shop, services, memo.seat, stopped.runId, memo.options.owner, queue, from)
        retried.push(playedOf({ ...done, path: done.path.slice(memo.progress.path.length) }, false, stopped.runId))
        if (done.failed === null) return done.waited === null ? "done" : "waiting"
        shop.memos.set(stopped.runId, { ...memo, progress: done })
        return "parked"
    }

/** A shop that keeps freezes of customers: the real freeze service and gate over the shop, and the retries the owner asked for. */
export interface FreezingShop extends Shop {
    /** The freezes the start of every run asks. */
    readonly freezes: ShopFreezes
    /** The part of each retried run after its failed step, in order. */
    readonly retried: Array<Played>
}

/** A shop whose every run start asks the gate of the freezes, and whose stopped runs freeze their customer. */
export const freezingShopOf = (store: Store): FreezingShop => {
    const shop = shopOf(store)
    const retried: Array<Played> = []
    const freezes = shopFreezesOf(store, resumeOf(shop, retried), shop.world.conversation, shop.workflows.graphs)
    shop.freezes = freezes
    return Object.assign(shop, { freezes, retried })
}
