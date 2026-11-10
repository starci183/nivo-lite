import { ChatConversationsService, ChatMessagesService } from "@modules/domain/chat-records"
import { ChannelSendExecutorService } from "../../../modules/domain/chat-node-ports/channel-send-executor.service"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { persistGraphTenant } from "../../fixtures/builders/agent-graph-world.builder"
import type { GraphTenant } from "../../fixtures/builders/agent-graph-world.builder"
import { API_APP_MODULES } from "../../world/api-app.options"
import { backendRoleSandbox } from "../../world/backend-role-sandbox.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { useTestWorld } from "../../world/use-test-world"
import { useSeedConnection } from "../../world/sales-door-world.service"

/** The real app opens in about a minute on the world; the whole suite shares that one boot. */
jest.setTimeout(240_000)

const world = useTestWorld({ modules: API_APP_MODULES, sandbox: backendRoleSandbox() })
const seed = useSeedConnection(world)

const who: GraphTenant = {
    workspaceId: world.id(),
    userId: world.id(),
    agentId: world.id(),
    versionId: world.id(),
}

const TEXT = "Em da ghi nhan don cua ban."

beforeAll(async () => {
    await persistGraphTenant(seed.manager, who)
    world.cleanup(async () => {
        await removeWorkspace(seed.manager, who.workspaceId)
        await removeAuthUsers(seed.manager, [who.userId])
    })
})

/** A conversation of the agent on a channel, with the customer's first line, and the turn that answers it. */
const conversationOn = async (
    channel: "website" | "zalo",
    customerId: string,
): Promise<{ readonly conversationId: string; readonly turn: NodeTurn }> => {
    const met = await world.resolve(ChatConversationsService).meet({
        workspaceId: who.workspaceId,
        agentId: who.agentId,
        channel,
        customerId,
        visitor: "Cuong",
        connectionId: world.id(),
    })
    await world
        .resolve(ChatMessagesService)
        .storeCustomer(who.workspaceId, met.conversation.id, "Cho minh dat 1 gio hoa nho", null, null)
    return {
        conversationId: met.conversation.id,
        turn: {
            turnId: world.id(),
            workspaceId: who.workspaceId,
            agentId: who.agentId,
            subject: null,
            conversationId: met.conversation.id,
            locale: "vi",
            origin: "customer",
            memberId: null,
        },
    }
}

const send = (turn: NodeTurn, conversationId: string, key: string) =>
    world.resolve(ChannelSendExecutorService).execute(turn, { conversationId, text: TEXT }, { key, dedupeKey: key })

/** The agent lines of the conversation that say `TEXT`. */
const sentLines = async (conversationId: string): Promise<number> =>
    (await world.resolve(ChatMessagesService).transcript(who.workspaceId, conversationId)).filter(
        (line) => line.role === "agent" && line.body === TEXT,
    ).length

describe("the channel.send step: store the message, deliver it, settle it", () => {
    it("stores the reply on the conversation, delivers it and settles it as sent: the channel has taken it", async () => {
        const { conversationId, turn } = await conversationOn("website", world.id())

        const stored = await send(turn, conversationId, `reply:${turn.turnId}`)

        expect(stored.kind).toBe("message")
        expect(await sentLines(conversationId)).toBe(1)
        await expect(
            world.resolve(ChatMessagesService).claimDelivery(who.workspaceId, conversationId, stored.id),
        ).resolves.toBe("acknowledged")
    })

    it("does not send twice when the step runs again (a resume or a replay of the same effect call): one stored message, one delivery", async () => {
        const { conversationId, turn } = await conversationOn("website", world.id())
        const key = `reply:${turn.turnId}`

        const first = await send(turn, conversationId, key)
        const again = await send(turn, conversationId, key)

        expect(again).toEqual(first)
        expect(await sentLines(conversationId)).toBe(1)
    })

    it("keeps a message that cannot leave in the conversation and answers the refusal, so the step's required send did not succeed", async () => {
        const { conversationId, turn } = await conversationOn("zalo", "import-cuong:1730000000")
        const key = `reply:${turn.turnId}`

        await expect(send(turn, conversationId, key)).resolves.toMatchObject({
            kind: "refused",
            id: "recipient_not_linked",
        })
        await expect(send(turn, conversationId, key)).resolves.toMatchObject({
            kind: "refused",
            id: "recipient_not_linked",
        })

        expect(await sentLines(conversationId)).toBe(1)
    })
})
