import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/blocks-core"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { AgentRunsService } from "@modules/domain/agent-runs"
import type { RunView, StepJson, StepSpec, StepView } from "@modules/domain/agent-runs"
import type { FlowWake } from "@modules/domain/agent-graphs"
import type { NodeToolDoor } from "@modules/domain/graph-nodes"
import { isDomainError } from "@modules/platform/errors"
import { agentTurnViewOf } from "./agent-work.builder"
import { runViewOf, stepViewOf } from "./agent-runs.builder"
import { NO_FLOW, flowServicesOf } from "./flow-f-world.builder"
import type { FlowModelScript, FlowServices } from "./flow-f-world.builder"
import type { Shop } from "./demo-flow-shop.builder"
import type { ModuleName } from "./workflow-world.builder"

/** The QR picture the QR tool draws for the demo order. */
export const QR_URL = "https://qr.sepay.vn/img?acc=0123456789&bank=Vietcombank&amount=450000&des=DH202611090001"

/** The row the shop's ledger gives the entry it is asked to write. */
const LEDGER_ROW = "Ledger!A2:G2"

/** The tools of the shop behind the gateway: the ledger of its books, where every entry lands on the next row of the sheet. */
export const doorOf = (shop: Shop): NodeToolDoor => ({
    call: (call) => {
        shop.toolCalls.push({ tool: call.tool, args: call.args, approved: call.approval !== null })
        if (call.tool === TOOL.ledgerAppend || call.tool === TOOL.ledgerVoid) return Promise.resolve({ ref: LEDGER_ROW })
        return Promise.resolve({})
    },
})

/** How one agent's run ended. */
export interface Played {
    /** The nodes done, in order. */
    readonly path: ReadonlyArray<string>
    /** The output of each node. */
    readonly outputs: Readonly<Record<string, StepJson>>
    /** The node that failed or threw, or null. */
    readonly failed: string | null
    /** The node that waited for the owner's approval of a tool call, or null. */
    readonly waited: string | null
    /** The message of the step that threw, or null. */
    readonly error: string | null
    /** True when the start of the run held the wake for a frozen customer: no run started, no node ran. */
    readonly held: boolean
    /** Why the start of the run took no wake (no workflow of the agent takes it), or null when a run started or the wake was held. */
    readonly skipped: string | null
    /** The run, or null when none started. */
    readonly runId: string | null
    /** The trigger scope the first step of the run was written with (`trigger.*` as its node reads it), or null when no run started. */
    readonly trigger: Readonly<Record<string, unknown>> | null
}

/** An agent and the module whose workflows it runs. */
export interface Seat {
    readonly id: string
    readonly module: ModuleName
}

/** What the shop's owner does while a run is played. */
export interface PlayOptions {
    /** What the owner does with a step that waits for a decision: approves it (the default) or leaves it open. */
    readonly owner?: "approves" | "leaves it open"
}

/** The mark a step key carries once the owner approved a tool call of its node. */
const APPROVED_MARK = "~approved-"

const nodeKeyOf = (stepKey: string): string => stepKey.split(APPROVED_MARK, 1).join("")

/** The fingerprint of the last tool call the shop asked its owner to approve, or an empty text when none was asked. */
const askedFingerprint = (shop: Shop): string => {
    const ask = shop.world.ran.findLast(
        (entry) => entry.effect === TOOL.workItemRaise && entry.payload.action === "approve_tool_call",
    )
    const asked: unknown = ask?.payload.payload
    const fingerprint: unknown =
        typeof asked === "object" && asked !== null ? Reflect.get(asked, "fingerprint") : undefined
    return typeof fingerprint === "string" ? fingerprint : ""
}

/** A run being played: what it has done so far. */
export interface Progress {
    readonly path: ReadonlyArray<string>
    readonly earlier: Readonly<Record<string, StepJson>>
    readonly failed: string | null
    readonly waited: string | null
    readonly error: string | null
    /** The error code of the step that failed, or null. */
    readonly code: string | null
    /** The step that failed, with its input, or null. */
    readonly failedSpec: StepSpec | null
}

const failedWith = (
    progress: Progress,
    spec: StepSpec,
    error: string | null,
    code: string | null = null,
): Progress => ({
    ...progress,
    failed: spec.nodeKey,
    error,
    code,
    failedSpec: spec,
})

/** Plays the queued steps one after another; a step that waits for a tool approval is answered as the owner would, by approving. */
export const advance = async (
    shop: Shop,
    services: FlowServices,
    seat: Seat,
    runId: string,
    owner: PlayOptions["owner"],
    queue: ReadonlyArray<StepSpec>,
    progress: Progress,
): Promise<Progress> => {
    const [spec, ...rest] = queue
    if (spec === undefined || progress.failed !== null) return progress
    const view: StepView = stepViewOf({
        ...spec,
        runId,
        agentId: seat.id,
        earlier: { ...progress.earlier },
        result: null,
    })
    const answer = await services.steps.run(view).catch((cause: unknown) => ({
        kind: "threw" as const,
        message: cause instanceof Error ? cause.message : String(cause),
        code: isDomainError(cause) ? cause.code : "agent_runs_handler_threw",
    }))
    if (answer.kind === "threw") return failedWith(progress, spec, answer.message, answer.code)
    if (answer.kind === "wait") {
        const data = { fields: { fingerprint: askedFingerprint(shop) } }
        const decided = services.steps.onDecided(view, { approved: true, by: "owner-1", data })
        const waiting: Progress = { ...progress, waited: nodeKeyOf(spec.stepKey) }
        if (owner === "leaves it open") return waiting
        if (decided.kind !== "done") return failedWith(waiting, spec, "approval_unreadable")
        return advance(shop, services, seat, runId, owner, [...decided.next, ...rest], waiting)
    }
    if (answer.kind !== "done") return failedWith(progress, spec, null, answer.kind === "failed" ? answer.code : null)
    const next: Progress = {
        ...progress,
        path: [...progress.path, spec.nodeKey],
        earlier: { ...progress.earlier, [spec.stepKey]: answer.result },
    }
    return advance(shop, services, seat, runId, owner, [...rest, ...answer.next], next)
}

/** What a run that stopped keeps for the fake engine to run it again from its failed step. */
export interface RunMemo {
    readonly seat: Seat
    readonly model: FlowModelScript
    readonly options: PlayOptions
    readonly progress: Progress
}

/** How a run ended, from what it did: its path, the output of each node, and where it failed, waited or was held. */
export const playedOf = (
    done: Progress,
    held: boolean,
    runId: string | null,
    skipped: string | null = null,
    first: StepSpec | undefined = undefined,
): Played => {
    const outputs = Object.fromEntries(Object.entries(done.earlier).map(([key, result]) => [nodeKeyOf(key), result]))
    const trigger: unknown = first?.input.trigger
    return {
        path: done.path,
        outputs,
        failed: done.failed,
        waited: done.waited,
        error: done.error,
        held,
        skipped,
        runId,
        trigger: typeof trigger === "object" && trigger !== null ? Object.fromEntries(Object.entries(trigger)) : null,
    }
}

export const START: Progress = {
    path: [],
    earlier: {},
    failed: null,
    waited: null,
    error: null,
    code: null,
    failedSpec: null,
}

/** What the run engine is given to open a run: the wake it answers and the trigger, intact. */
interface RunOpening {
    readonly wakeId: string
    readonly context: StepJson
}

/** Where a played run stands for the engine's guards: parked on a failure, waiting on the owner, or done. */
const statusOf = (done: Progress): RunView["status"] => {
    if (done.failed !== null) return "parked"
    return done.waited === null ? "done" : "waiting"
}

/** The graph a play passes the services: with workflows, every step reads its graph by its version id, never this one. */
const ENGINE_GRAPH: GraphSpec = NO_FLOW

/**
 * Runs one agent's wake the way the run engine does: the REAL `AgentGraphFlowRunsService.run` routes it to one of the agent's workflows
 * (by a hand-off's pin, else by a trigger's source, channel and conditions), asks the gate of the freezes when the shop keeps any, opens
 * the run, pins it and writes the first step; the steps that follow are played one after another over the lead memory of the shop.
 */
export const play = async (
    shop: Shop,
    seat: Seat,
    wake: FlowWake,
    model: FlowModelScript,
    options: PlayOptions = {},
): Promise<Played> => {
    const runId = `run-${shop.runs.length + 1}`
    const appended: Array<StepSpec> = []
    const runs = mock<AgentRunsService>({
        open: (_tx: unknown, input: RunOpening) => {
            const view = runViewOf({ id: runId, agentId: seat.id, wakeId: input.wakeId, context: input.context })
            shop.runViews.set(runId, view)
            return Promise.resolve(view)
        },
        runOf: (_workspace: string, id: string) => Promise.resolve(shop.runViews.get(id) ?? null),
        append: (_workspace: string, _tx: unknown, _run: string, specs: ReadonlyArray<StepSpec>) => {
            appended.push(...specs)
            return Promise.resolve()
        },
    })
    const gate = shop.freezes === null ? {} : { gate: shop.freezes.gate }
    const engine = {
        runs,
        workflows: shop.workflows,
        memory: shop.memory,
        holds: shop.holds,
        ledger: shop.ledger,
        guarded: true,
        ...gate,
    }
    const services = await flowServicesOf(shop.world, ENGINE_GRAPH, model, doorOf(shop), engine)
    shop.wakes += 1
    const turn = agentTurnViewOf({
        agentId: seat.id,
        wakeId: `wake-${shop.wakes}`,
        eventKey: `event-${shop.wakes}`,
        source: wake.source,
        actorMemberId: wake.actorMemberId,
        context: structuredClone(wake.context),
    })
    const ending = await services.flows.run(turn)
    if (ending.status === "held") return playedOf(START, true, null)
    if (ending.status !== "done") return playedOf(START, false, null, ending.reason)
    shop.runs.push(seat.id)
    const done = await advance(shop, services, seat, runId, options.owner, appended, START)
    const view = shop.runViews.get(runId)
    if (view !== undefined) shop.runViews.set(runId, { ...view, status: statusOf(done) })
    if (done.failed !== null) {
        shop.memos.set(runId, { seat, model, options, progress: done })
        await shop.freezes?.stop(services, seat, runId, { ...turn.context }, done)
    }
    return playedOf(done, false, runId, null, appended.at(0))
}
