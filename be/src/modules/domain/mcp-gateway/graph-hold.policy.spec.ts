import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { argsHashOf } from "./audit-mask.policy"
import { graphHoldOf } from "./graph-hold.policy"
import type { GatewayCaller, ToolGraphGate, ToolGraphVerdict } from "./mcp-gateway.contracts"

/** The members of the subject under test. */
interface Subject {
    readonly graphHoldOf: typeof graphHoldOf
}

const SUBJECT = Symbol("graph-hold.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { graphHoldOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const CALLER: GatewayCaller = { workspaceId: "ws-1", agentId: "sales", conversationId: "conv-1", workItemId: null }
const CALL = { name: "gmail.send", scope: "write", sent: { to: "a@b.c" } } as const

const gateOf = (verdict: ToolGraphVerdict) => mock<ToolGraphGate>({ judge: jest.fn().mockResolvedValue(verdict) })

describe("graph-hold.policy graphHoldOf", () => {
    it("holds a write the graph stops: not granted, refused in the audit with the code graph_stop", async () => {
        const subject = await build()

        await expect(subject.graphHoldOf(gateOf({ kind: "stop" }), CALLER, CALL)).resolves.toEqual({
            result: { ok: false, code: "not_granted", detail: "graph_stop" },
            outcome: "refused",
            code: "graph_stop",
        })
    })

    it("holds a write the graph asks about the way a held call is held: approval required, with the code graph_ask", async () => {
        const subject = await build()

        await expect(subject.graphHoldOf(gateOf({ kind: "ask" }), CALLER, CALL)).resolves.toEqual({
            result: { ok: false, code: "approval_required", reason: "graph_ask" },
            outcome: "approval",
            code: "graph_ask",
        })
    })

    it("lets a write the graph lets through run", async () => {
        const subject = await build()

        await expect(subject.graphHoldOf(gateOf({ kind: "run" }), CALLER, CALL)).resolves.toBeNull()
    })

    it("asks the graph about the call, keyed on the operation, else the work item, else the arguments", async () => {
        const subject = await build()
        const gate = gateOf({ kind: "run" })

        await subject.graphHoldOf(gate, { ...CALLER, opKey: "op-1", workItemId: "item-1", turnId: "turn-1" }, CALL)
        await subject.graphHoldOf(gate, { ...CALLER, workItemId: "item-1" }, CALL)
        await subject.graphHoldOf(gate, CALLER, CALL)

        expect(gate.judge.mock.calls.map((call) => call[0])).toEqual([
            {
                workspaceId: "ws-1",
                agentId: "sales",
                conversationId: "conv-1",
                key: "op-1",
                name: "gmail.send",
                turnId: "turn-1",
            },
            {
                workspaceId: "ws-1",
                agentId: "sales",
                conversationId: "conv-1",
                key: "item-1",
                name: "gmail.send",
                turnId: null,
            },
            {
                workspaceId: "ws-1",
                agentId: "sales",
                conversationId: "conv-1",
                key: argsHashOf(CALL.sent),
                name: "gmail.send",
                turnId: null,
            },
        ])
    })

    it("never holds a call when no graph is bound, a read, or a call a person approved, and asks the graph nothing", async () => {
        const subject = await build()
        const gate = gateOf({ kind: "stop" })

        await expect(subject.graphHoldOf(null, CALLER, CALL)).resolves.toBeNull()
        await expect(subject.graphHoldOf(gate, CALLER, { ...CALL, scope: "read" })).resolves.toBeNull()
        await expect(subject.graphHoldOf(gate, { ...CALLER, approvedBy: "manager-1" }, CALL)).resolves.toBeNull()
        expect(gate.judge).not.toHaveBeenCalled()
    })
})
