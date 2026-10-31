import assert from "node:assert/strict"
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
    lapseLease,
    removeDrainJobs,
    settleAgentWork,
    turnsOfWake,
    wakeOfFact,
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
const AGENT = identity.agents.accounting

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

const failures = async () => (await world.resolve(AgentWorkSettingsService).stateOf(AGENT)).failures

const down = () => Promise.reject(new TestWorldError({ code: TestWorldErrorCode.ProviderDown }))

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

describe("agent-work/runtime-down: the customer is answered and the failure still counts", () => {
    it("agent-work/runtime-down: a customer wake ends done through the hold-over line and the breaker count rises", async () => {
        const wake = customerWake("down", "conv-down")
        scripted().script = { run: down }
        await post(wake)

        await drain("conversation:conv-down")

        expect((await rowOf(wake)).status).toBe("done")
        expect(await failures()).toBe(1)
    })

    it("agent-work/breaker-hold-over: a hold-over does not close the breaker, an answered turn does", async () => {
        scripted().script = { run: down }
        await post(customerWake("down-1", "conv-b1"))
        await post(customerWake("down-2", "conv-b2"))
        await drain("conversation:conv-b1")
        await drain("conversation:conv-b2")
        expect(await failures()).toBe(2)

        scripted().script = { run: () => Promise.resolve({ kind: "blocked", reason: "quota" }) }
        await post(customerWake("blocked", "conv-b3"))
        await drain("conversation:conv-b3")
        expect(await failures()).toBe(2)

        scripted().script = {}
        await post(customerWake("answered", "conv-b4"))
        await drain("conversation:conv-b4")
        expect(await failures()).toBe(0)
    })
})

describe("agent-work/kill-takeover: a crashed turn is not left running", () => {
    it("agent-work/kill-takeover: a lapsed lease of a killed agent is taken over, its turn abandoned and its wake held", async () => {
        const wake = wakeOf("crashed")
        await post(wake)
        const begun = await world.resolve(AgentTurnsService).begin(AGENT, "agent", "worker-one")
        assert(begun.result === "begun")
        await lapseLease(em(), AGENT, "agent")
        await world.resolve(AgentWorkSettingsService).setAgentWork(identity.users.nam, WS, AGENT, false)

        await drain()

        const [turn] = await turnsOfWake(em(), begun.turn.wakeId)
        expect(turn?.status).toBe("abandoned")
        expect((await rowOf(wake)).status).toBe("held")
        expect(scripted().ran).toHaveLength(0)
    })
})

describe("agent-work/cap: a failed background turn spends the day", () => {
    it("agent-work/cap-failed: a schedule wake that failed counts toward the day's cap", async () => {
        scripted().script = { run: down }
        await post(wakeOf("cap-failed", { source: "schedule" }))

        await drain()

        expect((await world.resolve(AgentWorkSettingsService).stateOf(AGENT)).backgroundTurns).toBe(1)
    })
})
