import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentTurnsService } from "./agent-turns.service"
import { AgentWorkErrorCode } from "./errors/agent-work.error"
import { AgentTurnEntity } from "./persistence/entities"
import type { AgentTurnEnding } from "./agent-work.contracts"

const call = (name: string, args: number): string =>
    `SELECT * FROM "public"."${name}"(${Array.from({ length: args }, (_, index) => `$${String(index + 1)}`).join(", ")})`

const turn = agentTurnViewOf()

const ending = (over: Partial<AgentTurnEnding> = {}): AgentTurnEnding => ({
    status: "done",
    reason: null,
    outcome: { reply: "ok" },
    errorCode: null,
    usage: { model: "p/m", promptTokens: 1, completionTokens: 2, cost: 0.5, durationMs: 30 },
    ...over,
})

const build = async (em: MockEntityManager) => {
    const container = await Test.createTestingModule({
        providers: [AgentTurnsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return container.get(AgentTurnsService)
}

describe("AgentTurnsService.begin", () => {
    it("asks the database for the next turn of the scope with the worker and the lease", async () => {
        const em = mockEntityManager({
            query: [call("agent_turn_begin", 4), [{ agent_turn_begin: { result: "idle" } }]],
        })
        const service = await build(em)

        await expect(service.begin("agent-1", "agent", "worker-1")).resolves.toEqual({ result: "idle" })
        expect(em.query).toHaveBeenCalledWith(call("agent_turn_begin", 4), ["agent-1", "agent", "worker-1", 90])
    })

    it("reads a begun turn", async () => {
        const answer = {
            result: "begun",
            workspaceId: "ws-1",
            fence: 3,
            turnId: "turn-1",
            wakeId: "wake-1",
            source: "customer",
            eventKey: "msg-1",
            context: {},
            actorMemberId: null,
            attempts: 1,
            maxAttempts: 2,
            wakeCreatedAt: "2026-11-10T03:00:00.000Z",
            proposal: null,
        }
        const service = await build(
            mockEntityManager({ query: [call("agent_turn_begin", 4), [{ agent_turn_begin: answer }]] }),
        )

        await expect(service.begin("agent-1", "conversation:conv-1", "worker-1")).resolves.toEqual({
            result: "begun",
            turn,
        })
    })

    it("refuses an answer it cannot read", async () => {
        const service = await build(
            mockEntityManager({ query: [call("agent_turn_begin", 4), [{ agent_turn_begin: 5 }]] }),
        )

        await expect(service.begin("agent-1", "agent", "worker-1")).rejects.toMatchObject({
            code: AgentWorkErrorCode.ResultRejected,
        })
    })

    it("refuses an answer with no row", async () => {
        const service = await build(mockEntityManager({ query: [call("agent_turn_begin", 4), []] }))

        await expect(service.begin("agent-1", "agent", "worker-1")).rejects.toMatchObject({
            code: AgentWorkErrorCode.ResultRejected,
        })
    })
})

describe("AgentTurnsService.touch", () => {
    it("renews the lease under the fence of the turn", async () => {
        const em = mockEntityManager({ query: [call("agent_turn_touch", 4), [{ agent_turn_touch: true }]] })
        const service = await build(em)

        await expect(service.touch(turn)).resolves.toBe(true)
        expect(em.query).toHaveBeenCalledWith(call("agent_turn_touch", 4), ["agent-1", "conversation:conv-1", 3, 90])
    })

    it("says the lease is lost when the database does not confirm it", async () => {
        const service = await build(
            mockEntityManager({ query: [call("agent_turn_touch", 4), [{ agent_turn_touch: false }]] }),
        )

        await expect(service.touch(turn)).resolves.toBe(false)
    })
})

describe("AgentTurnsService.propose", () => {
    it("stores the proposal as JSON text under the fence", async () => {
        const em = mockEntityManager({ query: [call("agent_turn_propose", 5), [{ agent_turn_propose: "stored" }]] })
        const service = await build(em)

        await expect(service.propose(turn, [{ reply: "an array stays JSON" }])).resolves.toBe("stored")
        expect(em.query).toHaveBeenCalledWith(call("agent_turn_propose", 5), [
            "turn-1",
            "agent-1",
            "conversation:conv-1",
            3,
            '[{"reply":"an array stays JSON"}]',
        ])
    })

    it.each(["fenced", "killed"])("passes on the answer %s", async (word) => {
        const service = await build(
            mockEntityManager({ query: [call("agent_turn_propose", 5), [{ agent_turn_propose: word }]] }),
        )

        await expect(service.propose(turn, null)).resolves.toBe(word)
    })

    it("refuses a word it does not know", async () => {
        const service = await build(
            mockEntityManager({ query: [call("agent_turn_propose", 5), [{ agent_turn_propose: "ok" }]] }),
        )

        await expect(service.propose(turn, {})).rejects.toMatchObject({ code: AgentWorkErrorCode.ResultRejected })
    })
})

describe("AgentTurnsService.finish", () => {
    it("ends the turn with its outcome and usage, the retry wait of the attempt and the breaker policy", async () => {
        const em = mockEntityManager({
            query: [call("agent_turn_finish", 12), [{ agent_turn_finish: { fenced: false, more: true } }]],
        })
        const service = await build(em)

        await expect(service.finish(turn, ending())).resolves.toEqual({ fenced: false, more: true })
        expect(em.query).toHaveBeenCalledWith(call("agent_turn_finish", 12), [
            "agent-1",
            "conversation:conv-1",
            3,
            "turn-1",
            "done",
            null,
            '{"reply":"ok"}',
            null,
            '{"model":"p/m","promptTokens":1,"completionTokens":2,"cost":0.5,"durationMs":30}',
            60,
            5,
            900,
        ])
    })

    it("sends no JSON for an ending that has no outcome and no usage", async () => {
        const em = mockEntityManager({
            query: [call("agent_turn_finish", 12), [{ agent_turn_finish: { fenced: true, more: false } }]],
        })
        const service = await build(em)

        await expect(
            service.finish(
                turn,
                ending({ status: "failed", reason: "error", outcome: null, errorCode: "X", usage: null }),
            ),
        ).resolves.toEqual({ fenced: true, more: false })
        expect(em.query.mock.calls[0]?.[1]).toEqual([
            "agent-1",
            "conversation:conv-1",
            3,
            "turn-1",
            "failed",
            "error",
            null,
            "X",
            null,
            60,
            5,
            900,
        ])
    })

    it("refuses an answer it cannot read", async () => {
        const service = await build(
            mockEntityManager({ query: [call("agent_turn_finish", 12), [{ agent_turn_finish: "no" }]] }),
        )

        await expect(service.finish(turn, ending())).rejects.toMatchObject({ code: AgentWorkErrorCode.ResultRejected })
    })
})

describe("AgentTurnsService.due", () => {
    it("reads the rows the sweep must look at", async () => {
        const rows = [
            {
                due_kind: "task",
                due_agent: "agent-1",
                due_workspace: "ws-1",
                due_scope: "agent",
                due_subject: "task-1",
                due_at: new Date("2026-11-10T03:00:00.000Z"),
            },
        ]
        const em = mockEntityManager({ query: [call("agent_work_due", 1), rows] })
        const service = await build(em)

        await expect(service.due(50)).resolves.toEqual([
            {
                kind: "task",
                agentId: "agent-1",
                workspaceId: "ws-1",
                scopeKey: "agent",
                subjectId: "task-1",
                at: new Date("2026-11-10T03:00:00.000Z"),
            },
        ])
        expect(em.query).toHaveBeenCalledWith(call("agent_work_due", 1), [50])
    })

    it("refuses rows it cannot read", async () => {
        const service = await build(mockEntityManager({ query: [call("agent_work_due", 1), [{ due_kind: "other" }]] }))

        await expect(service.due(50)).rejects.toMatchObject({ code: AgentWorkErrorCode.ResultRejected })
    })
})

describe("AgentTurnsService.bind", () => {
    it("records the runtime agent and session on the turn while it still runs", async () => {
        const em = mockEntityManager({ update: [AgentTurnEntity, { affected: 1 }] })
        const service = await build(em)

        await service.bind(turn, "runtime-1", "thread-1")

        expect(em.update).toHaveBeenCalledWith(
            AgentTurnEntity,
            { id: "turn-1", status: "running" },
            { runtimeAgentId: "runtime-1", threadKey: "thread-1" },
        )
    })
})
