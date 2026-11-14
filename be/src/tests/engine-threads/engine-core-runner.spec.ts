import { mock } from "@starci/jest-preset"
import type { EffectCall, SubjectRef } from "@nivo-lite/agent-sdk/node"
import {
    GraphNodesError,
    GraphNodesErrorCode,
    type NodeEffectExecutor,
    type NodeEffectRun,
    type NodeToolCall,
    type NodeTurn,
} from "@modules/domain/graph-nodes"
import type { NodeToolCallRun } from "@modules/domain/graph-nodes/graph-nodes.contracts"
import type { CallLogLine } from "@modules/domain/tool-call-log"
import { ToolRunnerService, type ToolRunnerParts } from "@modules/domain/tools"
import type { BoundAccount } from "@modules/domain/tools/agent-accounts.service"
import type { Logger } from "@modules/platform/logging"
import { MONEY_MOVE, NOTE_READ, NOTE_WRITE } from "@tests/fixtures/builders/engine-core-plugin.builder"
import { TickingClock } from "./thread-world-outside"

// ENGINE CORE: THE ONE RUNNER'S ACCOUNTS (frame `nivo-frame.templates`: "each node lists N accounts; the ToolRunner tries them by data
// then by node order and falls back by class"; `engineNoBusiness`: no money class), on the GENERIC fixture's test tools, with the REAL
// `ToolRunnerService` over two fixture accounts of the node, in order. Faked: the door (each account's answer), the ledger (once per key),
// the executor, the audit. A read falls over on ANY failure; a write only on a failure proved `not_sent`; an `unknown` outcome stops (it is
// thrown, never tried on the next account); every attempt is audited with its provider, account and attempt; the "money"-labelled write
// is run exactly as the plain one.

// The generic fixture installed beside the core (as every engine core world): the runner reads whether a call writes from the
// installation (`mutatesOf`: the test read declares `mutates: false`), never from the call.
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/engine-core-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/engine-core-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.CORE_PLUGIN], "engine-core") }
})

const TURN: NodeTurn = { turnId: "run-1", workspaceId: "ws-1", agentId: "agent-1", subject: null, conversationId: null, locale: "vi" }
const STEP = { nodeKey: "write", versionId: "tcore.edge@1", workflowId: "wf-1" }
const CALL: EffectCall = { key: "run-1:write:abc", dedupeKey: null }

/** The node's two accounts, in its order. */
const ACCOUNTS: ReadonlyArray<BoundAccount> = [
    { provider: "smtp", connectionId: "first" },
    { provider: "smtp", connectionId: "second" },
]

/** How each account answers: a value / subject, or the failure it throws. */
type Answering = ReadonlyMap<string, Error | null>

const notSent = () => new GraphNodesError({ code: GraphNodesErrorCode.ToolNotConnected, params: { tool: NOTE_WRITE } })
const unknownOutcome = () =>
    new GraphNodesError({ code: GraphNodesErrorCode.ToolFailed, params: { tool: NOTE_WRITE, reason: "timeout", proof: "unknown" } })

const runnerOf = (answering: Answering) => {
    const lines: Array<CallLogLine> = []
    const tried: Array<string | null> = []
    const answerOf = (connectionId: string | null): Error | null => answering.get(connectionId ?? "") ?? null
    const execute = (turn: NodeTurn): Promise<SubjectRef> => {
        const connectionId = turn.account?.connectionId ?? null
        tried.push(connectionId)
        const fault = answerOf(connectionId)
        return fault === null ? Promise.resolve({ kind: "note", id: `note-${connectionId ?? "none"}` }) : Promise.reject(fault)
    }
    const kept = new Map<string, SubjectRef>()
    const parts: ToolRunnerParts = {
        door: {
            call: (call: NodeToolCall) => {
                const connectionId = call.account?.connectionId ?? null
                tried.push(connectionId)
                const fault = answerOf(connectionId)
                return fault === null ? Promise.resolve({ read: connectionId }) : Promise.reject(fault)
            },
            effectRight: () => Promise.resolve(null),
        },
        registry: { executorOf: (effect): NodeEffectExecutor => ({ effect, execute }) },
        ledger: {
            once: async (_ws: string, _effect: string, call: EffectCall, act: () => Promise<SubjectRef>) => {
                const was = kept.get(call.key)
                if (was !== undefined) return was
                const subject = await act()
                kept.set(call.key, subject)
                return subject
            },
        },
        accounts: { boundAccountsOf: () => Promise.resolve(ACCOUNTS) },
        leads: null,
        audit: {
            append: (line) => {
                lines.push(line)
                return Promise.resolve()
            },
        },
        clock: new TickingClock(),
        logger: mock<Logger>(),
    }
    return { runner: new ToolRunnerService(parts), lines, tried }
}

const writeOf = (effect: string): NodeEffectRun => ({
    road: "effect",
    token: "tok",
    effect,
    payload: { noteId: "n1", text: "x" },
    call: CALL,
    approval: null,
    turn: TURN,
    workflowStep: STEP,
    attempt: { step: "run-1:write", startedAt: "2026-11-12T00:00:00.000Z" },
})

const READ: NodeToolCallRun = {
    road: "tool",
    token: "tok",
    tool: NOTE_READ,
    args: { noteId: "n1" },
    key: "run-1:check:abc",
    approval: null,
    turn: TURN,
    workflowStep: STEP,
}

describe("the runner tries the node's accounts in order and falls back by what a failure proves", () => {
    it("a write whose first account proves `not_sent` runs on the second; both attempts audited with provider, account, attempt", async () => {
        const { runner, lines, tried } = runnerOf(new Map([["first", notSent()]]))

        const answer = await runner.run(writeOf(NOTE_WRITE))

        expect(answer).toMatchObject({ road: "effect", via: { connectionId: "second" } })
        expect(tried).toEqual(["first", "second"])
        expect(lines.map((line) => [line.provider, line.connectionId, line.attempt, line.chosenBy, line.outcome])).toEqual([
            ["smtp", "first", 1, "order", "error"],
            ["smtp", "second", 2, "fallback", "ok"],
        ])
    })

    it("a write whose first account ends `unknown` stops there: the failure is thrown, the second account is never tried", async () => {
        const { runner, tried } = runnerOf(new Map([["first", unknownOutcome()]]))

        await expect(runner.run(writeOf(NOTE_WRITE))).rejects.toMatchObject({ code: GraphNodesErrorCode.ToolFailed })
        expect(tried).toEqual(["first"])
    })

    it("a read falls over on ANY failure", async () => {
        const { runner, tried } = runnerOf(new Map([["first", new Error("boom")]]))

        expect(await runner.run(READ)).toMatchObject({ road: "tool", value: { read: "second" }, via: { connectionId: "second" } })
        expect(tried).toEqual(["first", "second"])
    })

    it("no business: the write labelled money falls over and is audited exactly as the plain write", async () => {
        const plain = runnerOf(new Map([["first", notSent()]]))
        const money = runnerOf(new Map([["first", notSent()]]))

        await plain.runner.run(writeOf(NOTE_WRITE))
        await money.runner.run(writeOf(MONEY_MOVE))

        expect(money.tried).toEqual(plain.tried)
        const shape = (lines: ReadonlyArray<CallLogLine>) => lines.map((line) => [line.connectionId, line.attempt, line.outcome])
        expect(shape(money.lines)).toEqual(shape(plain.lines))
    })

    it("the ledger answers a replay of the same call key: the write acts once across two runs of the call", async () => {
        const { runner, tried } = runnerOf(new Map())

        await runner.run(writeOf(NOTE_WRITE))
        await runner.run(writeOf(NOTE_WRITE))

        expect(tried).toEqual(["first"])
    })
})
