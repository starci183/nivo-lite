import assert from "node:assert/strict"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentDrainService } from "../../../modules/domain/agent-work/agent-drain.service"
import { AgentTurnsService } from "../../../modules/domain/agent-work/agent-turns.service"
import { AgentWakeService } from "../../../modules/domain/agent-work/agent-wake.service"
import { AgentWorkSettingsService } from "../../../modules/domain/agent-work/agent-work-settings.service"
import type { AgentWake } from "../../../modules/domain/agent-work/agent-work.contracts"
import { agentWakeOf } from "../../fixtures/builders/agent-work.builder"
import { persistOfficeRows } from "../../fixtures/builders/office-chain.builder"
import type { OfficeIdentity } from "../../fixtures/builders/office-chain.builder"
import { AGENT_WORK_MODULES, ScriptedAgentWork } from "../../world/agent-work-capabilities.options"
import {
    drainJobsOf,
    endRetryWait,
    lapseLease,
    removeDrainJobs,
    settleAgentWork,
    turnsOfWake,
    wakeOfFact,
    wakesOfFact,
} from "../../world/agent-work-database.service"
import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: AGENT_WORK_MODULES })

const identity: OfficeIdentity = {
    workspaceId: world.id(),
    users: { nam: world.id(), minh: world.id(), ha: world.id(), van: world.id(), lan: world.id() },
    agents: { sales: world.id(), accounting: world.id(), care: world.id() },
}
const WS = identity.workspaceId
const AGENT = identity.agents.care

const em = () => world.db.primary
const scripted = () => world.resolve(ScriptedAgentWork)

const wakeOf = (eventKey: string, over: Partial<AgentWake> = {}): AgentWake =>
    agentWakeOf({
        workspaceId: WS,
        agentId: AGENT,
        eventKey: `${world.prefix}:${eventKey}`,
        context: {},
        actorMemberId: null,
        ...over,
    })

const customerWake = (eventKey: string, conversationId: string): AgentWake =>
    wakeOf(eventKey, { source: "customer", context: { conversationId } })

const post = (wake: AgentWake) => em().transaction((tx) => world.resolve(AgentWakeService).wake(tx, wake))

const drain = (scopeKey = "agent") =>
    world.resolve(AgentDrainService).drain({ workspaceId: WS, agentId: AGENT, scopeKey })

const rowOf = (wake: AgentWake) => wakeOfFact(em(), wake.agentId, wake.source, wake.eventKey)

const wakeJobKey = (wake: AgentWake) => `agent-turn:${wake.agentId}:${wake.source}:${wake.eventKey}`

beforeAll(async () => {
    world.cleanup(async () => {
        await removeDrainJobs(em(), WS)
        await removeWorkspace(em(), WS)
        await removeAuthUsers(em(), Object.values(identity.users))
    })
    await persistOfficeRows(em(), identity)
})

beforeEach(() => {
    scripted().reset()
})

afterEach(() => settleAgentWork(em(), WS))

describe("agent-work/wake: one door, one fact", () => {
    it("agent-work/wake-atomic: a rolled-back caller leaves no wake and no job", async () => {
        const wake = wakeOf("atomic")
        await expect(
            em().transaction(async (tx) => {
                await world.resolve(AgentWakeService).wake(tx, wake)
                throw new TestWorldError({ code: TestWorldErrorCode.TransactionRefused })
            }),
        ).rejects.toThrow(TestWorldErrorCode.TransactionRefused)
        expect(await wakesOfFact(em(), AGENT, wake.eventKey)).toBe(0)
        expect(await drainJobsOf(em(), wakeJobKey(wake))).toHaveLength(0)

        await expect(post(wake)).resolves.toBe(true)
        expect(await wakesOfFact(em(), AGENT, wake.eventKey)).toBe(1)
        expect(await drainJobsOf(em(), wakeJobKey(wake))).toHaveLength(1)
    })

    it("agent-work/wake-dedupe: the same fact twice is one wake and one job", async () => {
        const wake = wakeOf("dedupe")
        await expect(post(wake)).resolves.toBe(true)
        await expect(post(wake)).resolves.toBe(false)
        await expect(Promise.all([post(wake), post(wake)])).resolves.toEqual([false, false])
        expect(await wakesOfFact(em(), AGENT, wake.eventKey)).toBe(1)
        expect(await drainJobsOf(em(), wakeJobKey(wake))).toHaveLength(1)
    })
})

describe("agent-work/lock: one turn per scope", () => {
    it("agent-work/one-turn-per-agent: a second worker finds the agent busy and the wake is served once", async () => {
        const wake = wakeOf("one-turn")
        const release = scripted().hold()
        await post(wake)
        const first = drain()
        await scripted().entered(1)

        await drain()
        expect(scripted().ran).toHaveLength(1)
        expect((await rowOf(wake)).status).toBe("running")

        release()
        await first
        expect(scripted().ran).toHaveLength(1)
        expect(scripted().settled).toHaveLength(1)
        expect((await rowOf(wake)).status).toBe("done")
    })

    it("agent-work/conversations-in-parallel: two conversations of one agent run at once, one conversation never twice", async () => {
        const release = scripted().hold()
        const first = customerWake("conv-a-1", "conv-a")
        const second = customerWake("conv-a-2", "conv-a")
        const other = customerWake("conv-b-1", "conv-b")
        await Promise.all([post(first), post(second), post(other)])

        const runs = [drain("conversation:conv-a"), drain("conversation:conv-b")]
        await scripted().entered(2)
        expect(scripted().peak).toBe(2)
        await drain("conversation:conv-a")
        expect(scripted().ran).toHaveLength(2)

        release()
        await Promise.all(runs)
        expect((await rowOf(other)).status).toBe("done")
        expect((await rowOf(first)).status).toBe("done")
        expect((await rowOf(second)).status).toBe("pending")
    })

    it("agent-work/no-lost-wake: a wake that arrives while a turn runs is served by the follow-on drain, with no sweep", async () => {
        const running = wakeOf("no-lost-first")
        const arriving = wakeOf("no-lost-second")
        const release = scripted().hold()
        await post(running)
        const first = drain()
        await scripted().entered(1)
        await post(arriving)
        await drain()
        expect(scripted().ran).toHaveLength(1)

        release()
        await first
        const [turn] = await turnsOfWake(em(), (await rowOf(running)).id)
        assert(turn !== undefined)
        expect(await drainJobsOf(em(), `agent-turn:${AGENT}:next:${turn.id}`)).toHaveLength(1)

        await drain()
        expect((await rowOf(arriving)).status).toBe("done")
    })

    it("agent-work/priority: a tag passes a schedule that was written first", async () => {
        const schedule = wakeOf("priority-schedule", { source: "schedule" })
        const tag = wakeOf("priority-tag")
        await post(schedule)
        await post(tag)
        await drain()
        expect(scripted().settled).toEqual([(await rowOf(tag)).id])
        expect((await rowOf(schedule)).status).toBe("pending")
        await drain()
        expect(scripted().settled).toEqual([(await rowOf(tag)).id, (await rowOf(schedule)).id])
    })
})

describe("agent-work/fence: a lost lease and a poison wake", () => {
    it("agent-work/zombie-fenced: a worker past its lease is refused, and the new holder's effect happens once", async () => {
        const wake = wakeOf("zombie")
        const turns = world.resolve(AgentTurnsService)
        await post(wake)
        const stale = await turns.begin(AGENT, "agent", "worker-one")
        assert(stale.result === "begun")
        await lapseLease(em(), AGENT, "agent")

        await drain()
        expect(scripted().settled).toEqual([stale.turn.wakeId])
        expect((await rowOf(wake)).status).toBe("done")

        await expect(turns.propose(stale.turn, { reply: "late" })).resolves.toBe("fenced")
        await expect(
            turns.finish(stale.turn, { status: "done", reason: null, outcome: null, errorCode: null, usage: null }),
        ).resolves.toEqual({ fenced: true, more: false })
        expect(scripted().settled).toHaveLength(1)
        const [old] = await turnsOfWake(em(), stale.turn.wakeId)
        expect(old?.status).toBe("abandoned")
    })

    it("agent-work/poison: a wake that fails past its budget is dead and the next one runs", async () => {
        const poison = wakeOf("poison")
        const next = wakeOf("poison-next")
        scripted().script = {
            run: (turn) =>
                turn.eventKey === poison.eventKey
                    ? Promise.reject(new TestWorldError({ code: TestWorldErrorCode.ProviderDown }))
                    : Promise.resolve({ kind: "proposal", proposal: { reply: "ok" }, usage: null }),
        }
        await post(poison)
        await drain()
        const retrying = await rowOf(poison)
        expect(retrying.status).toBe("pending")
        expect(retrying.attempts).toBe(1)
        expect(retrying.notBefore.getTime()).toBeGreaterThan(retrying.createdAt.getTime())

        await endRetryWait(em(), retrying.id)
        await drain()
        expect((await rowOf(poison)).status).toBe("pending")

        await endRetryWait(em(), retrying.id)
        await drain()
        expect((await rowOf(poison)).status).toBe("dead")

        await post(next)
        await drain()
        expect((await rowOf(next)).status).toBe("done")
    })
})

describe("agent-work/kill-switch: held, never dropped", () => {
    it("agent-work/kill-switch: killed wakes are held and never run, and switching on returns customer and tag wakes only", async () => {
        const settings = world.resolve(AgentWorkSettingsService)
        const customer = customerWake("kill-customer", "conv-kill")
        const tag = wakeOf("kill-tag")
        const schedule = wakeOf("kill-schedule", { source: "schedule" })

        await eachInOrder([identity.users.minh, identity.users.van], (user) =>
            expect(settings.setAgentWork(user, WS, AGENT, false)).rejects.toMatchObject({
                code: "WORKSPACE_MEMBERS_ROLE_FORBIDDEN",
            }),
        )
        expect((await settings.stateOf(AGENT)).workEnabled).toBe(true)

        await expect(settings.setAgentWork(identity.users.nam, WS, AGENT, false)).resolves.toMatchObject({
            workEnabled: false,
        })
        await Promise.all([post(customer), post(tag), post(schedule)])
        await drain("conversation:conv-kill")
        await drain()
        expect(scripted().ran).toHaveLength(0)
        expect((await rowOf(customer)).status).toBe("held")
        expect((await rowOf(tag)).status).toBe("held")
        expect((await rowOf(schedule)).status).toBe("held")
        expect((await rowOf(tag)).reason).toBe("killed")

        await settings.setAgentWork(identity.users.nam, WS, AGENT, true)
        expect((await rowOf(customer)).status).toBe("pending")
        expect((await rowOf(tag)).status).toBe("pending")
        expect((await rowOf(schedule)).status).toBe("skipped")

        await drain("conversation:conv-kill")
        await drain()
        expect(scripted().settled).toHaveLength(2)
        expect((await rowOf(customer)).status).toBe("done")
        expect((await rowOf(tag)).status).toBe("done")
    })

    it("agent-work/kill-switch: the workspace switch holds every agent and an agent of another workspace is refused", async () => {
        const settings = world.resolve(AgentWorkSettingsService)
        const wake = wakeOf("kill-workspace")
        await expect(settings.setWorkspaceWork(identity.users.minh, WS, false)).rejects.toMatchObject({
            code: "WORKSPACE_MEMBERS_ROLE_FORBIDDEN",
        })
        await expect(settings.setAgentWork(identity.users.nam, world.id(), AGENT, false)).rejects.toMatchObject({
            code: "WORKSPACE_MEMBERS_NOT_MEMBER",
        })
        expect((await settings.settingsOf(WS)).road).toBe("legacy")

        await settings.setWorkspaceWork(identity.users.nam, WS, false)
        await post(wake)
        await drain()
        expect(scripted().ran).toHaveLength(0)
        expect((await rowOf(wake)).status).toBe("held")

        await settings.setWorkspaceWork(identity.users.nam, WS, true)
        expect((await rowOf(wake)).status).toBe("pending")
        await drain()
        expect((await rowOf(wake)).status).toBe("done")
    })
})
