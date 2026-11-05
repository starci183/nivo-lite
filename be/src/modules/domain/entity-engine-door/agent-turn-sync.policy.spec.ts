import { Test } from "@nestjs/testing"
import type { DoorApi, DoorCallResult, MutationResult } from "@nivo-lite/agent-sdk/mutation"
import { EntityEngineDoorErrorCode } from "./errors/entity-engine-door.error"
import * as policy from "./agent-turn-sync.policy"
import type { TurnWriter } from "./agent-turn-sync.policy"

/** The policy as one provider, read through the Nest testing module. */
class PolicySubject {
    readonly syncAgentTurns = policy.syncAgentTurns
    readonly job = policy.syncAgentTurnsJob
}

const build = async (): Promise<PolicySubject> => {
    const moduleRef = await Test.createTestingModule({ providers: [PolicySubject] }).compile()
    return moduleRef.get(PolicySubject)
}

const INPUT = { agentKey: "nivo", sessionKey: "session-1" }

const TURNS = {
    turns: [
        { index: 0, role: "user", text: "hi", toolCalls: [], at: "2026-11-05T00:00:00.000Z" },
        {
            index: 1,
            role: "assistant",
            text: "ok",
            toolCalls: [{ name: "ledger.append", argsJson: "{}" }],
            at: "2026-11-05T00:00:01.000Z",
        },
    ],
}

/** A door that answers the same to every call and remembers the tools asked. */
interface FakeDoor {
    readonly door: DoorApi
    readonly calls: Array<string>
}

const doorOf = (answer: DoorCallResult): FakeDoor => {
    const calls: Array<string> = []
    return {
        calls,
        door: {
            call: (tool) => {
                calls.push(tool)
                return Promise.resolve(answer)
            },
        },
    }
}

const writerOf = (result: MutationResult<unknown> = { ok: true, row: {}, version: "1" }) => {
    const writes: Array<{ entity: string; on: string; values: Record<string, unknown> }> = []
    const entities: TurnWriter = {
        upsert: (entity, on, values) => {
            writes.push({ entity, on, values })
            return Promise.resolve(result)
        },
    }
    return { entities, writes }
}

describe("syncAgentTurns", () => {
    it("reads the session through the door and writes each turn under the (session, index) constraint", async () => {
        const subject = await build()
        const { door, calls } = doorOf({ ok: true, output: TURNS })
        const { entities, writes } = writerOf()
        await subject.syncAgentTurns({ door, entities }, INPUT)
        expect(calls).toEqual(["ai.agent.history"])
        expect(writes.map((write) => [write.entity, write.on, write.values.turnIndex])).toEqual([
            ["agent.turn", "session_turn_key", 0],
            ["agent.turn", "session_turn_key", 1],
        ])
        expect(writes[1]?.values).toEqual({
            agentKey: "nivo",
            sessionKey: "session-1",
            turnIndex: 1,
            role: "assistant",
            text: "ok",
            toolCalls: { calls: [{ name: "ledger.append", argsJson: "{}" }] },
            at: "2026-11-05T00:00:01.000Z",
        })
    })

    it("writes nothing for a session with no turns", async () => {
        const subject = await build()
        const { entities, writes } = writerOf()
        await subject.syncAgentTurns({ door: doorOf({ ok: true, output: { turns: [] } }).door, entities }, INPUT)
        expect(writes).toEqual([])
    })

    it("throws, for the queue to retry, when the door refuses", async () => {
        const subject = await build()
        const { entities, writes } = writerOf()
        const door = doorOf({ ok: false, reason: "transient", message: "down" }).door
        await expect(subject.syncAgentTurns({ door, entities }, INPUT)).rejects.toMatchObject({
            code: EntityEngineDoorErrorCode.SyncFailed,
            params: { reason: "transient" },
        })
        expect(writes).toEqual([])
    })

    it("throws when the door answers what cannot be read", async () => {
        const subject = await build()
        const door = doorOf({ ok: true, output: { turns: [{ index: "x" }] } }).door
        await expect(subject.syncAgentTurns({ door, entities: writerOf().entities }, INPUT)).rejects.toMatchObject({
            params: { reason: "history_unreadable" },
        })
    })

    it("throws when the engine refuses a write", async () => {
        const subject = await build()
        const { entities } = writerOf({ ok: false, reason: "invalid" })
        await expect(
            subject.syncAgentTurns({ door: doorOf({ ok: true, output: TURNS }).door, entities }, INPUT),
        ).rejects.toMatchObject({ params: { reason: "invalid" } })
    })
})

describe("syncAgentTurnsJob", () => {
    it("is the declared agent.sync-turns job over the door and the engine data port", async () => {
        const { job } = await build()
        expect(job.name).toBe("agent.sync-turns")
        expect(job.attempts).toBe(5)
        expect(Object.values(job.ports).map((port) => port.id)).toEqual(["engine.door", "engine.entities"])
    })

    it("runs the sync", async () => {
        const { job } = await build()
        const { entities, writes } = writerOf()
        const context = { workspaceId: "ws-1", attempt: 1, effectKey: (step: string) => step }
        await job.run({ door: doorOf({ ok: true, output: TURNS }).door, entities }, INPUT, context)
        expect(writes).toHaveLength(2)
    })
})
