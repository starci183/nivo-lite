import assert from "node:assert/strict"
import { CustomerIntakeService } from "../../../modules/domain/conversations/customer-intake.service"
import { AgentWorkError, AgentWorkErrorCode } from "../../../modules/domain/agent-work/errors/agent-work.error"
import { persistOfficeRows } from "../../fixtures/builders/office-chain.builder"
import type { OfficeIdentity } from "../../fixtures/builders/office-chain.builder"
import { persistRoad } from "../../fixtures/builders/agent-work.builder"
import { agentCustomerModules, chatJobsOf, removeCustomerRows } from "../../world/agent-work-customer.options"
import { removeDrainJobs, settleAgentWork, wakeOfFact, wakesOfFact } from "../../world/agent-work-database.service"
import { worldIds } from "../../world/lite-world.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: agentCustomerModules(`agent-customer-${worldIds.next()}`) })

const identity: OfficeIdentity = {
    workspaceId: world.id(),
    users: { nam: world.id(), minh: world.id(), ha: world.id(), van: world.id(), lan: world.id() },
    agents: { sales: world.id(), accounting: world.id(), care: world.id() },
}
const WS = identity.workspaceId
const AGENT = identity.agents.care

const em = () => world.db.primary
const intake = () => world.resolve(CustomerIntakeService)

const messageOf = (messageId: string) => ({
    workspaceId: WS,
    agentId: AGENT,
    conversationId: world.id(),
    messageId,
    channelEventId: `tg:${messageId}`,
    lookupName: false,
})

beforeAll(async () => {
    world.cleanup(async () => {
        await removeDrainJobs(em(), WS)
        await removeCustomerRows(em(), WS)
        await removeWorkspace(em(), WS)
        await removeAuthUsers(em(), Object.values(identity.users))
    })
    await persistOfficeRows(em(), identity)
})

afterEach(() => settleAgentWork(em(), WS))

describe("agent-work/road-legacy-core: the intake of a customer message", () => {
    it("agent-work/road-legacy-core: the same message is a chat-turn job on the legacy road and a customer wake on the core road, never both", async () => {
        const legacy = world.id()
        const core = world.id()

        await persistRoad(em(), WS, "legacy")
        await em().transaction((tx) => intake().answer(messageOf(legacy), tx))
        await persistRoad(em(), WS, "core")
        await em().transaction((tx) => intake().answer(messageOf(core), tx))

        assert.equal((await chatJobsOf(em(), legacy)).length, 1)
        assert.equal(await wakesOfFact(em(), AGENT, legacy), 0)
        assert.equal((await chatJobsOf(em(), core)).length, 0)
        const wake = await wakeOfFact(em(), AGENT, "customer", core)
        assert.equal(wake.scopeKey.startsWith("conversation:"), true)
        assert.equal(wake.status, "pending")
    })

    it("agent-work/road-legacy-core: a message delivered twice is one wake on the core road, and a rolled-back intake leaves nothing", async () => {
        const once = world.id()
        const rolledBack = world.id()
        await persistRoad(em(), WS, "core")

        await em().transaction((tx) => intake().answer(messageOf(once), tx))
        await em().transaction((tx) => intake().answer(messageOf(once), tx))
        await assert.rejects(
            em().transaction(async (tx) => {
                await intake().answer(messageOf(rolledBack), tx)
                throw new AgentWorkError({ code: AgentWorkErrorCode.AgentNotFound })
            }),
        )

        assert.equal(await wakesOfFact(em(), AGENT, once), 1)
        assert.equal(await wakesOfFact(em(), AGENT, rolledBack), 0)
        assert.equal((await chatJobsOf(em(), rolledBack)).length, 0)
    })

    it("agent-work/road-legacy-core: rolling back to legacy changes only new intake, and the wake already written stays", async () => {
        const before = world.id()
        const after = world.id()
        await persistRoad(em(), WS, "core")
        await em().transaction((tx) => intake().answer(messageOf(before), tx))

        await persistRoad(em(), WS, "legacy")
        await em().transaction((tx) => intake().answer(messageOf(after), tx))

        assert.equal(await wakesOfFact(em(), AGENT, before), 1)
        assert.equal((await chatJobsOf(em(), after)).length, 1)
        assert.equal(await wakesOfFact(em(), AGENT, after), 0)
    })
})
