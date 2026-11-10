import { ChatConversationsService, ChatMessagesService } from "@modules/domain/chat-records"
import { ChatSendNativeService } from "@modules/domain/channels"
import { McpGatewayError, McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { persistGraphTenant } from "../../fixtures/builders/agent-graph-world.builder"
import type { GraphTenant } from "../../fixtures/builders/agent-graph-world.builder"
import { API_APP_MODULES } from "../../world/api-app.options"
import { backendRoleSandbox, currentRole } from "../../world/backend-role-sandbox.service"
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
const OTHER_WORKSPACE = world.id()

const QUESTION = "Shop mo cua may gio?"
const ANSWER = "Shop mo cua tu 8 gio sang."

beforeAll(async () => {
    await persistGraphTenant(seed.manager, who)
    world.cleanup(async () => {
        await removeWorkspace(seed.manager, who.workspaceId)
        await removeAuthUsers(seed.manager, [who.userId])
    })
})

/** The conversation a website customer opened, with the line that waits for its answer. */
const customerChat = async (): Promise<{ readonly conversationId: string; readonly messageId: string }> => {
    const met = await world.resolve(ChatConversationsService).meet({
        workspaceId: who.workspaceId,
        agentId: who.agentId,
        channel: "website",
        customerId: world.id(),
        visitor: "Lan",
        connectionId: world.id(),
    })
    const heard = await world
        .resolve(ChatMessagesService)
        .storeCustomer(who.workspaceId, met.conversation.id, QUESTION, null, null)
    return { conversationId: met.conversation.id, messageId: heard.id }
}

/** Runs the tool `nivo.chat.send` of the chat connector for a workspace, as the gateway does once the door resolved the domain tool. */
const send = (workspaceId: string, args: Readonly<Record<string, string>>) =>
    world
        .resolve(ChatSendNativeService)
        .invoke(workspaceId, "send", args, { agentId: who.agentId, conversationId: null })

describe("the chat path on records, as the back-end role", () => {
    it("runs on a connection that is the back-end role, so the policies are the deployed ones", async () => {
        expect(await currentRole(world.db.primary)).toBe("app_be")
    })

    it("hears the customer once: the same channel line stored twice is one record", async () => {
        const { conversationId } = await customerChat()
        const messages = world.resolve(ChatMessagesService)
        const first = await messages.storeCustomer(who.workspaceId, conversationId, "Xin chao", "web:1", null)
        const again = await messages.storeCustomer(who.workspaceId, conversationId, "Xin chao", "web:1", null)
        expect(first.stored).toBe(true)
        expect(again).toEqual({ id: first.id, stored: false })
    })

    it("sends the reply with nivo.chat.send, stores it once under its key and delivers it on the channel of the conversation", async () => {
        const { conversationId, messageId } = await customerChat()
        const input = { conversationId, text: ANSWER, key: `reply:${messageId}` }

        await expect(send(who.workspaceId, input)).resolves.toEqual({ ok: true })
        await expect(send(who.workspaceId, input)).resolves.toEqual({ ok: true })

        const lines = await world.resolve(ChatMessagesService).transcript(who.workspaceId, conversationId)
        expect(lines.filter((line) => line.body === ANSWER)).toHaveLength(1)
    })

    it("refuses a conversation of another workspace as an answer and writes nothing there", async () => {
        const { conversationId } = await customerChat()
        const refused = new McpGatewayError({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_found" },
        })
        await expect(send(OTHER_WORKSPACE, { conversationId, text: ANSWER, key: "other" })).rejects.toEqual(refused)
        const lines = await world.resolve(ChatMessagesService).transcript(who.workspaceId, conversationId)
        expect(lines.some((line) => line.body === ANSWER)).toBe(false)
    })
})
