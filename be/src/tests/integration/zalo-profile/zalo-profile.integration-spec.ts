import { ZaloCredentialsService } from "@modules/domain/channels"
import { agentsEntities } from "@modules/domain/agents"
import { ChatConversationsService } from "@modules/domain/chat-records"
import { PollLimiterService } from "@modules/domain/connection-poll"
import { mcpCallLogEntities } from "@modules/domain/mcp-call-log"
import { ZaloReconcileService } from "@modules/domain/zalo-provider"
import { ZALO } from "@modules/integrations/zalo"
import type { ZaloClient } from "@modules/integrations/zalo"
import { eachInOrder } from "@modules/platform/primitives"
import { persistGraphTenant } from "../../fixtures/builders/agent-graph-world.builder"
import type { GraphTenant } from "../../fixtures/builders/agent-graph-world.builder"
import { API_APP_MODULES } from "../../world/api-app.options"
import { backendRoleSandbox } from "../../world/backend-role-sandbox.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { useSeedConnection } from "../../world/sales-door-world.service"
import { useTestWorld } from "../../world/use-test-world"

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

const GUEST = "Zalo guest"
const OA_ACCESS = "access-token"
const ROWS_MAX = 20

const [AgentEntity] = agentsEntities
const [McpCallLogEntity] = mcpCallLogEntities

beforeAll(async () => {
    await persistGraphTenant(seed.manager, who)
    world.cleanup(async () => {
        await removeWorkspace(seed.manager, who.workspaceId)
        await removeAuthUsers(seed.manager, [who.userId])
    })
})

/** What the recording Zalo port was asked, in order: the access token and the customer id. */
const asked: Array<{ readonly token: string; readonly userId: string }> = []

/** The rate buckets the round took a token from, in order: the provider and the connection. The limiter store is Redis, which the world has not. */
const passes: Array<{ readonly provider: string; readonly connectionId: string }> = []

/** What Zalo answers by customer id; a customer it does not name makes Zalo fail. */
const profiles = new Map<string, { readonly name: string; readonly avatarUrl: string }>()

beforeEach(() => {
    asked.length = 0
    passes.length = 0
    jest.spyOn(world.resolve(PollLimiterService), "pass").mockImplementation((provider, connectionId) => {
        passes.push({ provider, connectionId })
        return Promise.resolve()
    })
    profiles.clear()
    jest.spyOn(world.resolve(ZaloCredentialsService), "accessToken").mockResolvedValue(OA_ACCESS)
    jest.spyOn(world.resolve<ZaloClient>(ZALO), "userProfile").mockImplementation((token, userId) => {
        asked.push({ token, userId })
        const profile = profiles.get(userId)
        return profile === undefined ? Promise.reject(new Error("zalo refused")) : Promise.resolve(profile)
    })
})

afterEach(() => {
    jest.restoreAllMocks()
})

/** A Zalo customer's conversation on a connection, opened as the webhook opens it: named after nobody. */
const met = (connectionId: string, customerId: string) =>
    world.resolve(ChatConversationsService).meet({
        workspaceId: who.workspaceId,
        agentId: who.agentId,
        channel: "zalo",
        customerId,
        visitor: GUEST,
        connectionId,
    })

/** The name the inbox shows for the customer. */
const nameOf = async (connectionId: string, customerId: string): Promise<string | null> => {
    const found = await world.resolve(ChatConversationsService).find(who.workspaceId, "zalo", connectionId, customerId)
    return found.kind === "ok" ? found.value.visitorName : null
}

/** One reconcile run of the connection, as the reconcile job runs it: the missed messages first (this connection has none), then the profiles. */
const round = (connectionId: string) =>
    world.resolve(ZaloReconcileService).run({ workspaceId: who.workspaceId, connectionId })

describe("the profile round of a Zalo connection", () => {
    it("names a customer through the door, logs the call under the internal agent, and asks Zalo nothing the second time", async () => {
        const connection = world.id()
        profiles.set("u-minh", { name: "Minh Anh", avatarUrl: "https://zalo.test/minh.png" })
        await met(connection, "u-minh")

        await round(connection)

        expect(asked).toEqual([{ token: OA_ACCESS, userId: "u-minh" }])
        expect(passes).toEqual([{ provider: "zalo_oa", connectionId: connection }])
        expect(await nameOf(connection, "u-minh")).toBe("Minh Anh")
        await round(connection)
        expect(asked).toHaveLength(1)
        const [nivo] = await seed.manager.find(AgentEntity, {
            select: { id: true },
            where: { workspaceId: who.workspaceId, module: "nivo" },
            take: 1,
        })
        const logged = await seed.manager.find(McpCallLogEntity, {
            select: { connector: true, tool: true, outcome: true },
            where: { workspaceId: who.workspaceId, agentId: String(nivo?.id) },
            take: ROWS_MAX,
        })
        expect(logged.map(({ connector, tool, outcome }) => ({ connector, tool, outcome }))).toEqual([
            { connector: "chat", tool: "nivo.chat.profile.get", outcome: "ok" },
        ])
    })

    it("keeps the guest name when Zalo fails, and tries that customer again only after the pause", async () => {
        const connection = world.id()
        await met(connection, "u-bad")

        await round(connection)

        expect(await nameOf(connection, "u-bad")).toBe(GUEST)
        await round(connection)
        expect(asked).toEqual([{ token: OA_ACCESS, userId: "u-bad" }])
    })

    it("reads at most ten customers of a connection in a round and the rest in the next", async () => {
        const connection = world.id()
        const customers = Array.from({ length: 12 }, (_value, index) => `u-${index}`)
        customers.forEach((id) => profiles.set(id, { name: `Khach ${id}`, avatarUrl: "" }))
        await eachInOrder(customers, (id) => met(connection, id).then(() => undefined))

        await round(connection)
        expect(asked).toHaveLength(10)
        await round(connection)

        expect(asked).toHaveLength(12)
        expect(passes).toHaveLength(12)
        expect(new Set(asked.map((call) => call.userId)).size).toBe(12)
        expect(await nameOf(connection, "u-0")).toBe("Khach u-0")
    })
})
