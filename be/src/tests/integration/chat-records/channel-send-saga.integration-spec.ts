import { ChannelDeliveriesService, CustomerRoutesService } from "@modules/domain/customer-routes"
import { ContactsService } from "@modules/domain/contacts"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { ChannelSendExecutorService } from "../../../modules/domain/chat-node-ports/channel-send-executor.service"
import { persistGraphTenant, type GraphTenant } from "../../fixtures/builders/agent-graph-world.builder"
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

/**
 * A person the workspace met on a channel entrance, their route there, and the turn of the agent that answers them (the one send tool
 * addresses the PERSON: the engine keeps no conversation record, the route and the delivery ledger are what a send leaves).
 */
const personOn = async (
    channel: "website" | "zalo",
    channelUserId: string,
): Promise<{ readonly routeId: string; readonly contactId: string; readonly turn: NodeTurn }> => {
    const accountId = world.id()
    const contactId = await world
        .resolve(ContactsService)
        .meetChannel(who.workspaceId, { channel, account: accountId, userId: channelUserId, name: "Cuong" })
    const { routeId } = await world.resolve(CustomerRoutesService).ensure(who.workspaceId, { contactId, channel, accountId })
    return {
        routeId,
        contactId,
        turn: {
            turnId: world.id(),
            workspaceId: who.workspaceId,
            agentId: who.agentId,
            subject: null,
            conversationId: routeId,
            contactId,
            locale: "vi",
            origin: "customer",
            memberId: null,
        },
    }
}

const send = (turn: NodeTurn, key: string) =>
    world.resolve(ChannelSendExecutorService).execute(turn, { text: TEXT }, { key, dedupeKey: key })

/** The delivery ledger row of a send key: the engine's one record of what was said and how it ended. */
const ledgerRowOf = (key: string) => world.resolve(ChannelDeliveriesService).byKey(who.workspaceId, key)

describe("the customer send: claim in the delivery ledger, deliver, settle", () => {
    it("claims the send in the ledger, delivers it and settles it as delivered: the website chat has taken it", async () => {
        const { turn } = await personOn("website", `visitor:${world.id()}`)
        const key = `reply:${turn.turnId}`

        const receipt = await send(turn, key)

        expect(receipt.kind).toBe("message")
        expect(await ledgerRowOf(key)).toMatchObject({ sendKey: key, text: TEXT, state: "delivered" })
    })

    it("does not send twice when the step runs again (a resume or a replay of the same effect call): the same receipt, one ledger row", async () => {
        const { turn } = await personOn("website", `visitor:${world.id()}`)
        const key = `reply:${turn.turnId}`

        const first = await send(turn, key)
        const again = await send(turn, key)

        expect(again).toEqual(first)
        expect(await ledgerRowOf(key)).toMatchObject({ sendKey: key, state: "delivered" })
    })

    it("answers a message that cannot leave as a refusal fact the step reads (the account is gone), the same on a replay, and sends nothing", async () => {
        const { turn } = await personOn("zalo", "import-cuong:1730000000")
        const key = `reply:${turn.turnId}`

        await expect(send(turn, key)).resolves.toMatchObject({ kind: "refused", id: "connection_missing" })
        await expect(send(turn, key)).resolves.toMatchObject({ kind: "refused", id: "connection_missing" })

        expect(await ledgerRowOf(key)).not.toMatchObject({ state: "delivered" })
    })
})
