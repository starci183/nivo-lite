import assert from "node:assert/strict"
import {
    AgentConversationsReadService,
    AgentConversationsService,
    ConversationHandoverService,
    agentConversationsEntities,
} from "@modules/domain/agent-conversations"
import { DealWonEvent } from "@modules/events/api"
import type { EventDelivery } from "@modules/platform/event-bus"
import { persistOfficeRows } from "../../fixtures/builders/office-chain.builder"
import type { OfficeIdentity } from "../../fixtures/builders/office-chain.builder"
import { agentCustomerModules, removeCustomerRows } from "../../world/agent-work-customer.options"
import { removeDrainJobs } from "../../world/agent-work-database.service"
import { worldIds } from "../../world/lite-world.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { useTestWorld } from "../../world/use-test-world"

const [AgentConversationEntity] = agentConversationsEntities

const world = useTestWorld({ modules: agentCustomerModules(`workbench-handover-${worldIds.next()}`) })

const identity: OfficeIdentity = {
    workspaceId: world.id(),
    users: { nam: world.id(), minh: world.id(), ha: world.id(), van: world.id(), lan: world.id() },
    agents: { sales: world.id(), accounting: world.id(), care: world.id() },
}
const WS = identity.workspaceId
/** The agent that opens the door, and the agent a hand-over gives the conversation to. */
const FRONT = identity.agents.care
const SALES = identity.agents.sales

const em = () => world.db.primary
const conversations = () => world.resolve(AgentConversationsService)
const handover = () => world.resolve(ConversationHandoverService)

/** A customer conversation the front agent speaks in, tied to a customer. */
const openCustomerChat = async (leadId: string): Promise<string> => {
    const chat = await em().transaction((tx) =>
        conversations().openChat({ workspaceId: WS, agentId: FRONT, kind: "customer", visitorName: "Lan" }, tx),
    )
    await conversations().attachLead(WS, chat.id, leadId)
    return chat.id
}

const rowOf = (id: string) => em().findOneOrFail(AgentConversationEntity, { where: { id } })

const dealWon = (leadId: string): EventDelivery<DealWonEvent> => {
    const event = DealWonEvent.create({ workspaceId: WS, leadId, name: "Lan" })
    return {
        correlationId: "corr-1",
        eventId: event.eventId,
        consumer: "deal_won__conversation_handback",
        dedupeKey: `${world.prefix}:${event.payload.dedupeKey}`,
        event,
        attempt: 1,
    }
}

const move = (conversationId: string, from: string, to: string) =>
    handover().handOver({ workspaceId: WS, conversationId, fromAgentId: from, toAgentId: to, reason: "Need on record" })

beforeAll(async () => {
    world.cleanup(async () => {
        await removeDrainJobs(em(), WS)
        await removeCustomerRows(em(), WS)
        await removeWorkspace(em(), WS)
        await removeAuthUsers(em(), Object.values(identity.users))
    })
    await persistOfficeRows(em(), identity)
})

describe("workbench/handover-one-name: the customer keeps one conversation across two agents", () => {
    it("moves the speaker, remembers the agent that opened the door and keeps it on a second hand-over", async () => {
        const id = await openCustomerChat(world.id())

        assert.equal(await move(id, FRONT, SALES), true)
        const handed = await rowOf(id)
        assert.equal(handed.agentId, SALES)
        assert.equal(handed.frontAgentId, FRONT)

        assert.equal(await move(id, SALES, identity.agents.accounting), true)
        const again = await rowOf(id)
        assert.equal(again.agentId, identity.agents.accounting)
        assert.equal(again.frontAgentId, FRONT)
    })

    it("keeps the chat in the list of the front agent and puts it in the list of the speaker", async () => {
        const id = await openCustomerChat(world.id())
        await move(id, FRONT, SALES)
        const reads = world.resolve(AgentConversationsReadService)

        const front = await reads.customerOfAgents(WS, [FRONT], 50)
        const sales = await reads.customerOfAgents(WS, [SALES], 50)

        assert.ok(front.some((row) => row.id === id))
        assert.ok(sales.some((row) => row.id === id))
        assert.equal(front.find((row) => row.id === id)?.agent_id, SALES)
        assert.equal(front.find((row) => row.id === id)?.front_agent_id, FRONT)
    })

    it("leaves a conversation a person holds where it is", async () => {
        const id = await openCustomerChat(world.id())
        await conversations().handToPerson(WS, id, "Mai")

        assert.equal(await move(id, FRONT, SALES), false)
        assert.equal((await rowOf(id)).agentId, FRONT)
    })
})

describe("workbench/handback: a won deal returns the conversation to the agent that opened it", () => {
    it("returns it once, and a redelivery changes nothing", async () => {
        const leadId = world.id()
        const id = await openCustomerChat(leadId)
        await move(id, FRONT, SALES)

        await handover().handBack(dealWon(leadId))
        assert.equal((await rowOf(id)).agentId, FRONT)

        await move(id, FRONT, SALES)
        await handover().handBack(dealWon(leadId))
        assert.equal((await rowOf(id)).agentId, SALES)
    })

    it("leaves a conversation a person holds with Sales", async () => {
        const leadId = world.id()
        const id = await openCustomerChat(leadId)
        await move(id, FRONT, SALES)
        await conversations().handToPerson(WS, id, "Mai")

        await handover().handBack(dealWon(leadId))

        assert.equal((await rowOf(id)).agentId, SALES)
    })
})
