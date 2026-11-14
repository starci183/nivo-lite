import { FakeClock, mock } from "@starci/jest-preset"
import type { EffectCall, SubjectRef } from "@nivo-lite/agent-sdk/node"
import {
    GraphNodesError,
    GraphNodesErrorCode,
    toolFingerprintOf,
    type NodeEffectExecutor,
    type NodeEffectRun,
    type NodeToolCall,
    type NodeTurn,
} from "@modules/domain/graph-nodes"
import type { CallLogLine } from "@modules/domain/tool-call-log"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { BoundAccount } from "./agent-accounts.service"
import type { Logger } from "@modules/platform/logging"
import { ToolRunnerService, type ToolRunnerParts } from "./tool-runner.service"

const TURN: NodeTurn = {
    turnId: "run-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: "conv-1",
    locale: "vi",
}

const CALL: EffectCall = { key: "run-1:send:abc", dedupeKey: null }

const SENT: SubjectRef = { kind: "message", id: "m-1" }

const STEP = { nodeKey: "send", versionId: "v-1", workflowId: "wf-1" }

const effectOf = (payload: Readonly<Record<string, unknown>>, overrides: Partial<NodeEffectRun> = {}): NodeEffectRun => ({
    road: "effect",
    token: "tok",
    effect: "nivo.tool.customer.message.send",
    payload,
    call: CALL,
    approval: null,
    turn: TURN,
    workflowStep: STEP,
    attempt: { step: "run-1:send", startedAt: "2026-11-12T00:00:00.000Z" },
    ...overrides,
})

/** One record the ledger kept for a step: what ran, with what, what it answered, when. */
interface KeptRecord {
    readonly effect: string
    readonly args: Readonly<Record<string, unknown>> | null
    readonly subject: SubjectRef
    readonly at: string
}

/** A ledger as the host keeps it: the subject of a key answered again, a refusal never kept, the step's records read back. */
const ledgerOf = (records: Array<KeptRecord> = []) => {
    const kept = new Map<string, SubjectRef>()
    return {
        kept,
        records,
        once: jest.fn(
            async (
                _ws: string,
                effect: string,
                call: EffectCall,
                act: () => Promise<SubjectRef>,
                record?: { readonly args?: Readonly<Record<string, unknown>> | undefined },
            ) => {
                const was = kept.get(call.key)
                if (was !== undefined) return was
                const subject = await act()
                if (subject.kind === "refused") return subject
                kept.set(call.key, subject)
                records.push({ effect, args: record?.args ?? null, subject, at: "2026-11-12T00:00:00.500Z" })
                return subject
            },
        ),
        recordsOf: jest.fn((_ws: string, _place: unknown, effects: ReadonlyArray<string>) =>
            Promise.resolve(records.filter((one) => effects.includes(one.effect))),
        ),
    }
}

const worldOf = (overrides: Partial<ToolRunnerParts> = {}, records: Array<KeptRecord> = []) => {
    const lines: Array<CallLogLine> = []
    const execute = jest.fn<Promise<SubjectRef>, Parameters<NodeEffectExecutor["execute"]>>(() => Promise.resolve(SENT))
    const ledger = ledgerOf(records)
    const door = {
        call: jest.fn<Promise<unknown>, [NodeToolCall]>(() => Promise.resolve({ value: 1 })),
        effectRight: jest.fn<Promise<SubjectRef | null>, []>(() => Promise.resolve(null)),
    }
    const parts: ToolRunnerParts = {
        door,
        registry: { executorOf: (effect) => ({ effect, execute }) },
        ledger,
        leads: { leadOf: () => Promise.resolve("lead-1") },
        audit: {
            append: (line) => {
                lines.push(line)
                return Promise.resolve()
            },
        },
        clock: new FakeClock(new Date("2026-11-12T00:00:00.000Z")),
        logger: mock<Logger>(),
        ...overrides,
    }
    return { runner: new ToolRunnerService(parts), lines, execute, ledger, door }
}

describe("ToolRunnerService", () => {
    it("runs a tool through the door's call, under the key it was given", async () => {
        const world = worldOf()
        const tool = {
            road: "tool" as const,
            token: "tok",
            tool: "nivo.tool.brain.search",
            args: {},
            key: "run-1:a:x",
            approval: null,
            turn: TURN,
        }
        await expect(world.runner.run(tool)).resolves.toEqual({ road: "tool", value: { value: 1 } })
        expect(world.door.call).toHaveBeenCalledWith(tool)
        expect(world.lines).toEqual([])
    })

    it("runs an effect once per key, hands the executor the turn with the step, and files one audit line per call", async () => {
        const world = worldOf()
        const payload = { conversationId: "conv-1", text: "Dạ" }

        await expect(world.runner.run(effectOf(payload))).resolves.toEqual({ road: "effect", subject: SENT })
        await expect(world.runner.run(effectOf(payload))).resolves.toEqual({ road: "effect", subject: SENT })

        expect(world.execute).toHaveBeenCalledTimes(1)
        expect(world.execute.mock.calls[0]?.[0]).toMatchObject({ step: STEP })
        expect(world.lines.map((line) => [line.tool, line.outcome, line.errorCode])).toEqual([
            ["nivo.tool.customer.message.send", "ok", null],
            ["nivo.tool.customer.message.send", "ok", "receipt_replay"],
        ])
        expect(world.lines[0]).toMatchObject({
            connector: "customer",
            runId: "run-1",
            originKind: "node",
            nodeKey: "send",
            workflowId: "wf-1",
            workflowVersionId: "v-1",
        })
    })

    it("answers the right's refusal without running or keeping anything", async () => {
        const world = worldOf()
        world.door.effectRight.mockResolvedValueOnce({ kind: "refused", id: "not_attached" })

        const answer = await world.runner.run(effectOf({ conversationId: "conv-1", text: "x" }))

        expect(answer).toEqual({ road: "effect", subject: { kind: "refused", id: "not_attached" } })
        expect(world.ledger.once).not.toHaveBeenCalled()
        expect(world.lines.map((line) => [line.outcome, line.errorCode])).toEqual([["refused", "not_attached"]])
    })

    it("on the template road hands the door `refusals: \"answer\"`, and audits a right's refusal it throws as the refusal it is", async () => {
        const world = worldOf()
        world.door.effectRight.mockRejectedValueOnce(
            new GraphNodesError({ code: GraphNodesErrorCode.ToolNotGranted, params: { tool: TOOL.agentTag, reason: "tool_off" } }),
        )

        await expect(
            world.runner.run(effectOf({ conversationId: "conv-1", text: "x" }, { refusals: "answer" })),
        ).rejects.toMatchObject({ code: GraphNodesErrorCode.ToolNotGranted })

        expect(world.door.effectRight.mock.calls[0]).toEqual([expect.objectContaining({ refusals: "answer" })])
        expect(world.ledger.once).not.toHaveBeenCalled()
        expect(world.lines.map((line) => [line.outcome, line.errorCode])).toEqual([["refused", "tool_off"]])
    })

    it("keeps an effect inside its run: another conversation or another lead is refused before the ledger", async () => {
        const world = worldOf()

        const other = await world.runner.run(effectOf({ conversationId: "conv-2", text: "x" }))
        const lead = await world.runner.run(effectOf({ leadId: "lead-9" }, { effect: "nivo.tool.order.create" }))
        const own = await world.runner.run(effectOf({ leadId: "lead-1" }, { effect: "nivo.tool.order.create" }))

        expect(other).toEqual({ road: "effect", subject: { kind: "refused", id: "conversation_mismatch" } })
        expect(lead).toEqual({ road: "effect", subject: { kind: "refused", id: "lead_mismatch" } })
        expect(own).toEqual({ road: "effect", subject: SENT })
        expect(world.execute).toHaveBeenCalledTimes(1)
    })

    it("a retried step answers its earlier send at the same position from its receipt, whatever its words now (run eb7c6306)", async () => {
        // The first attempt (before the retry) told the customer once; the retry, with no words of a person, rewords the line.
        const told: KeptRecord = {
            effect: "nivo.tool.customer.message.send",
            args: { conversationId: "conv-1", text: "Dạ shop gửi giá ạ" },
            subject: { kind: "message", id: "m-first" },
            at: "2026-11-11T23:59:00.000Z",
        }
        const world = worldOf({}, [told])
        const retried = effectOf(
            { conversationId: "conv-1", text: "Dạ giá bên shop là 200k ạ" },
            { call: { key: "run-1:send:reworded", dedupeKey: null } },
        )

        const answer = await world.runner.run(retried)

        expect(answer).toEqual({ road: "effect", subject: { kind: "message", id: "m-first" } })
        expect(world.execute).not.toHaveBeenCalled()
        expect(world.ledger.once).not.toHaveBeenCalled()
        expect(world.lines.map((line) => [line.outcome, line.errorCode])).toEqual([["ok", "receipt_replay"]])
    })

    it("a second send of the retried attempt, past the earlier attempt's sends, acts for real", async () => {
        const told: KeptRecord = {
            effect: "nivo.tool.customer.message.send",
            args: { conversationId: "conv-1", text: "một" },
            subject: { kind: "message", id: "m-first" },
            at: "2026-11-11T23:59:00.000Z",
        }
        const world = worldOf({}, [told])

        await world.runner.run(effectOf({ conversationId: "conv-1", text: "một nữa" }, { call: { key: "run-1:send:a", dedupeKey: null } }))
        const second = await world.runner.run(
            effectOf({ conversationId: "conv-1", text: "hai" }, { call: { key: "run-1:send:b", dedupeKey: null } }),
        )

        expect(second).toEqual({ road: "effect", subject: SENT })
        expect(world.execute).toHaveBeenCalledTimes(1)
    })

    it("the same arguments replay under their own key; a person's words since the earlier send let the step tell anew", async () => {
        const told: KeptRecord = {
            effect: "nivo.tool.customer.message.send",
            args: { conversationId: "conv-1", text: "x" },
            subject: { kind: "message", id: "m-first" },
            at: "2026-11-11T23:59:00.000Z",
        }
        const same = worldOf({}, [told])
        same.ledger.kept.set("run-1:send:abc", told.subject)
        await expect(same.runner.run(effectOf({ conversationId: "conv-1", text: "x" }))).resolves.toEqual({
            road: "effect",
            subject: told.subject,
        })
        expect(same.ledger.once).toHaveBeenCalledTimes(1)

        const answered = worldOf({}, [told])
        const turn: NodeTurn = { ...TURN, founderAnswers: [{ text: "ghi nhận", at: "2026-11-11T23:59:30.000Z" }] }
        await expect(
            answered.runner.run(effectOf({ conversationId: "conv-1", text: "Dạ đã ghi nhận ạ" }, { turn })),
        ).resolves.toEqual({ road: "effect", subject: SENT })
        expect(answered.execute).toHaveBeenCalledTimes(1)
    })

    it("the engine's own words among the answers (an approved call's answer) start no new stretch: the receipt still answers", async () => {
        const told: KeptRecord = {
            effect: "nivo.tool.customer.message.send",
            args: { conversationId: "conv-1", text: "x" },
            subject: { kind: "message", id: "m-first" },
            at: "2026-11-11T23:59:00.000Z",
        }
        const world = worldOf({}, [told])
        const engineWords = { text: "approved call ran", at: "2026-11-11T23:59:30.000Z", by: "engine" }
        const turn: NodeTurn = { ...TURN, founderAnswers: [engineWords] }

        await expect(world.runner.run(effectOf({ conversationId: "conv-1", text: "y" }, { turn }))).resolves.toEqual({
            road: "effect",
            subject: told.subject,
        })
        expect(world.execute).not.toHaveBeenCalled()
    })

    it("an earlier write at that position whose outcome nobody knows answers that outcome: no machine makes it again", async () => {
        const unknown: KeptRecord = {
            effect: "nivo.tool.customer.message.send",
            args: { conversationId: "conv-1", text: "x" },
            subject: { kind: "outcome-unknown", id: "delivery_outcome_unknown" },
            at: "2026-11-11T23:59:00.000Z",
        }
        const world = worldOf({}, [unknown])

        await expect(world.runner.run(effectOf({ conversationId: "conv-1", text: "y" }))).rejects.toMatchObject({
            code: "delivery_outcome_unknown",
        })
        expect(world.execute).not.toHaveBeenCalled()
    })

    it("hands the executor the approver of exactly this call, and nobody for an approval of another call", async () => {
        const world = worldOf()
        const payload = { orderId: "o-1" }
        const fingerprint = toolFingerprintOf(TOOL.agentTag, payload, undefined)
        const approved = effectOf(payload, {
            effect: TOOL.agentTag,
            call: { key: "run-1:confirm:a", dedupeKey: null },
            approval: { by: "member-owner", fingerprint },
        })
        const other = effectOf(payload, {
            effect: TOOL.agentTag,
            call: { key: "run-1:confirm:b", dedupeKey: null },
            approval: { by: "member-owner", fingerprint: "another-call" },
        })

        await world.runner.run(approved)
        await world.runner.run(other)

        expect(world.execute.mock.calls.map(([turn]) => turn.approvedBy)).toEqual(["member-owner", undefined])
        expect(world.lines.map((line) => line.approvedBy)).toEqual(["member-owner", null])
    })

    it("files an ask as an approval line and throws it as it was", async () => {
        const world = worldOf()
        const ask = new GraphNodesError({
            code: GraphNodesErrorCode.ToolApprovalRequired,
            params: { tool: "nivo.tool.customer.message.send", fingerprint: "f", reason: "ask_mode", args: "{}" },
        })
        world.door.effectRight.mockRejectedValueOnce(ask)

        await expect(world.runner.run(effectOf({ conversationId: "conv-1", text: "x" }))).rejects.toBe(ask)
        expect(world.lines.map((line) => line.outcome)).toEqual(["approval"])
    })

    describe("an ask for a call its executor would refuse", () => {
        const ask = () =>
            new GraphNodesError({
                code: GraphNodesErrorCode.ToolApprovalRequired,
                params: { tool: "nivo.tool.customer.message.send", fingerprint: "f", reason: "ask_mode", args: "{}" },
            })
        const REFUSAL: SubjectRef = { kind: "refused", id: "outside_window", facts: { reason: "outside_window" } }

        /** A world whose executor implements the side-effect-free check, answering `would`. */
        const checking = (would: SubjectRef | null) => {
            const world = worldOf()
            const refusalFor = jest.fn<Promise<SubjectRef | null>, Parameters<NonNullable<NodeEffectExecutor["refusalFor"]>>>(() =>
                Promise.resolve(would),
            )
            const checked = worldOf({
                door: world.door,
                registry: { executorOf: (effect) => ({ effect, execute: world.execute, refusalFor }) },
            })
            return { ...checked, refusalFor, door: world.door, execute: world.execute }
        }

        it("answers the refusal it would have been and raises no approval: nothing runs, nothing is kept", async () => {
            const world = checking(REFUSAL)
            world.door.effectRight.mockRejectedValueOnce(ask())

            await expect(world.runner.run(effectOf({ text: "x" }))).resolves.toEqual({ road: "effect", subject: REFUSAL })

            expect(world.refusalFor).toHaveBeenCalledTimes(1)
            expect(world.refusalFor.mock.calls[0]?.[0]).toMatchObject({ step: STEP })
            expect(world.execute).not.toHaveBeenCalled()
            expect(world.lines.map((line) => [line.outcome, line.errorCode])).toEqual([["refused", "outside_window"]])
        })

        it("still asks when the executor finds nothing in the way", async () => {
            const world = checking(null)
            const raised = ask()
            world.door.effectRight.mockRejectedValueOnce(raised)

            await expect(world.runner.run(effectOf({ text: "x" }))).rejects.toBe(raised)
            expect(world.lines.map((line) => line.outcome)).toEqual(["approval"])
        })

        it("is not asked for an approved or an `auto` call: the executor judges at run, when state may have changed", async () => {
            const world = checking(REFUSAL)

            await world.runner.run(effectOf({ text: "x" }))

            expect(world.refusalFor).not.toHaveBeenCalled()
            expect(world.execute).toHaveBeenCalledTimes(1)
        })
    })

    it("keeps the call when its audit line cannot be written", async () => {
        const world = worldOf({ audit: { append: () => Promise.reject(new Error("db down")) } })
        await expect(world.runner.run(effectOf({ conversationId: "conv-1", text: "x" }))).resolves.toEqual({
            road: "effect",
            subject: SENT,
        })
    })
})

const C1: BoundAccount = { provider: "smtp", connectionId: "conn-1" }
const C2: BoundAccount = { provider: "smtp", connectionId: "conn-2" }

const toolOf = (tool: string) => ({
    road: "tool" as const,
    token: "tok",
    tool,
    args: { to: "a@b.vn" },
    key: "run-1:mail:x",
    approval: null,
    turn: TURN,
    workflowStep: STEP,
})

const failedWith = (proof: "not_sent" | "unknown"): GraphNodesError =>
    new GraphNodesError({ code: GraphNodesErrorCode.ToolFailed, params: { tool: "t", reason: "unavailable", proof } })

describe("ToolRunnerService accounts", () => {
    const withAccounts = (accounts: ReadonlyArray<BoundAccount>) => {
        const boundAccountsOf = jest.fn(() => Promise.resolve(accounts))
        return { world: worldOf({ accounts: { boundAccountsOf } }), boundAccountsOf }
    }

    it("hands a write the node's first bound account, asked for the step's node, and answers via it", async () => {
        const { world, boundAccountsOf } = withAccounts([C1, C2])

        const answer = await world.runner.run(toolOf(TOOL.mailMessageSend))

        expect(answer).toEqual({ road: "tool", value: { value: 1 }, via: C1 })
        expect(boundAccountsOf).toHaveBeenCalledWith("ws-1", "agent-1", TOOL.mailMessageSend, {
            origin: "node",
            node: STEP,
        })
        expect(world.door.call.mock.calls[0]).toEqual([
            expect.objectContaining({ account: { ...C1, attempt: 1, chosenBy: "order" } }),
        ])
    })

    it("goes on to the next account on a write failure proved not_sent, and stops on one whose outcome is unknown", async () => {
        const moved = withAccounts([C1, C2])
        moved.world.door.call.mockRejectedValueOnce(failedWith("not_sent"))
        await expect(moved.world.runner.run(toolOf(TOOL.mailMessageSend))).resolves.toEqual({
            road: "tool",
            value: { value: 1 },
            via: C2,
        })
        expect(moved.world.door.call.mock.calls.map(([call]) => call)).toEqual([
            expect.objectContaining({ account: { ...C1, attempt: 1, chosenBy: "order" } }),
            expect.objectContaining({ account: { ...C2, attempt: 2, chosenBy: "fallback" } }),
        ])

        const stopped = withAccounts([C1, C2])
        const unknown = failedWith("unknown")
        stopped.world.door.call.mockRejectedValueOnce(unknown)
        await expect(stopped.world.runner.run(toolOf(TOOL.mailMessageSend))).rejects.toBe(unknown)
        expect(stopped.world.door.call).toHaveBeenCalledTimes(1)
    })

    it("moves any write on by the one generic rule (a ledger write too: no business class), and never goes around a person's ask", async () => {
        const ledger = withAccounts([C1, C2])
        ledger.world.door.call.mockRejectedValueOnce(failedWith("not_sent"))
        await expect(ledger.world.runner.run(toolOf(TOOL.ledgerEntryAppend))).resolves.toEqual({
            road: "tool",
            value: { value: 1 },
            via: C2,
        })
        expect(ledger.world.door.call).toHaveBeenCalledTimes(2)

        const unsure = withAccounts([C1, C2])
        const unknown = failedWith("unknown")
        unsure.world.door.call.mockRejectedValueOnce(unknown)
        await expect(unsure.world.runner.run(toolOf(TOOL.ledgerEntryAppend))).rejects.toBe(unknown)
        expect(unsure.world.door.call).toHaveBeenCalledTimes(1)

        const asked = withAccounts([C1, C2])
        const ask = new GraphNodesError({
            code: GraphNodesErrorCode.ToolApprovalRequired,
            params: { tool: "t", fingerprint: "f", reason: "ask_mode", args: "{}" },
        })
        asked.world.door.call.mockRejectedValueOnce(ask)
        await expect(asked.world.runner.run(toolOf(TOOL.mailMessageSend))).rejects.toBe(ask)
        expect(asked.world.door.call).toHaveBeenCalledTimes(1)
    })

    it("hands a read no account (it covers every bound account) and a customer send none (its conversation owns the account)", async () => {
        const { world, boundAccountsOf } = withAccounts([C1, C2])

        await world.runner.run(toolOf(TOOL.bankTransactionList))
        await world.runner.run(effectOf({ conversationId: "conv-1", text: "x" }))

        expect(boundAccountsOf).not.toHaveBeenCalled()
        expect(world.door.call.mock.calls[0]?.[0]).not.toHaveProperty("account")
        expect(world.door.effectRight.mock.calls[0]).toEqual([expect.not.objectContaining({ account: expect.anything() })])
    })

    it("judges an effect on its account, hands the executor the account, and audits where it ran", async () => {
        const { world } = withAccounts([{ provider: "smtp", connectionId: "bank-1" }])

        const answer = await world.runner.run(effectOf({ orderId: "o-1" }, { effect: TOOL.mailMessageSend }))

        expect(answer).toEqual({ road: "effect", subject: SENT, via: { provider: "smtp", connectionId: "bank-1" } })
        expect(world.door.effectRight.mock.calls[0]).toEqual([
            expect.objectContaining({ account: { provider: "smtp", connectionId: "bank-1", attempt: 1, chosenBy: "order" } }),
        ])
        expect(world.execute.mock.calls[0]?.[0]).toMatchObject({ account: { provider: "smtp", connectionId: "bank-1" } })
        expect(world.lines[0]).toMatchObject({ connectionId: "bank-1", provider: "smtp", attempt: 1, chosenBy: "order" })
    })
})
