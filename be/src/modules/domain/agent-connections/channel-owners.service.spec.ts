import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BINDING_AGENTS } from "./agent-connections.decorators"
import type { BindingAgent, BindingAgentsDirectory } from "./agent-connections.port"
import { ChannelOwnersService } from "./channel-owners.service"
import { AgentConnectionsErrorCode } from "./errors/agent-connections.error"
import { AgentConnectionEntity } from "./persistence/entities"

const linkOf = (agentId: string, connectionId: string, purpose: string, access: string, day: number) =>
    Object.assign(new AgentConnectionEntity(), {
        agentId,
        connectionId,
        workspaceId: "w1",
        purpose,
        access,
        createdAt: new Date(`2026-11-0${day}T00:00:00.000Z`),
    })

const agentOf = (id: string, module: string, name: string): BindingAgent => ({
    id,
    module,
    name,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
})

const LINKS = [
    linkOf("c-bot", "tg1", "inbound_chat", "auto", 1),
    linkOf("s-lan", "tg1", "outbound_chat", "ask", 2),
    linkOf("s-minh", "tg1", "outbound_chat", "ask", 3),
    linkOf("s-minh", "zl1", "outbound_chat", "auto", 4),
    linkOf("s-paused", "zl2", "outbound_chat", "ask", 5),
]

const AGENTS = [
    agentOf("c-bot", "chatbot", "Front desk"),
    agentOf("s-lan", "sales", "Lan"),
    agentOf("s-minh", "sales", "Minh"),
]

const build = async (entityManager: MockEntityManager, agents: ReadonlyArray<BindingAgent> = AGENTS) => {
    const directory = mock<BindingAgentsDirectory>()
    directory.activeCreatedAmong.mockResolvedValue([...agents])
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelOwnersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: BINDING_AGENTS, useValue: directory },
        ],
    }).compile()
    return { service: moduleRef.get(ChannelOwnersService), directory }
}

describe("ChannelOwnersService > ownerOf", () => {
    it("answers the one Sales agent that owns a connection: the one granted first", async () => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, LINKS.slice(0, 3)] })
        const { service, directory } = await build(em)

        const owner = await service.ownerOf("tg1", "sales")

        expect(owner).toMatchObject({ connectionId: "tg1", agentId: "s-lan", agentName: "Lan", module: "sales" })
        expect(em.find).toHaveBeenCalledWith(AgentConnectionEntity, {
            where: { connectionId: "tg1", purpose: In(["inbound_chat", "outbound_chat", "lead_source"]) },
            order: { createdAt: "ASC" },
            take: 500,
        })
        expect(directory.activeCreatedAmong).toHaveBeenCalledWith("w1", ["c-bot", "s-lan", "s-minh"], 500)
    })

    it("answers the chatbot of the same connection for the chatbot role", async () => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, LINKS.slice(0, 3)] })
        const { service } = await build(em)

        expect((await service.ownerOf("tg1", "chatbot"))?.agentId).toBe("c-bot")
    })

    it("answers no owner when no agent of the role is bound, and reads no agents for a connection nobody uses", async () => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, []] })
        const { service, directory } = await build(em)

        expect(await service.ownerOf("tg9", "sales")).toBeNull()
        expect(directory.activeCreatedAmong).not.toHaveBeenCalled()
    })

    it("leaves out an agent that is not active", async () => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, LINKS.slice(4, 5)] })
        const { service } = await build(em)

        expect(await service.ownerOf("zl2", "sales")).toBeNull()
    })
})

describe("ChannelOwnersService > ownersOf", () => {
    it("lists, per channel connection of the workspace, the agent of the role that answers it", async () => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, LINKS] })
        const { service } = await build(em)

        const owners = await service.ownersOf("w1", "sales")

        expect(owners.map((owner) => [owner.connectionId, owner.agentName])).toEqual([
            ["tg1", "Lan"],
            ["zl1", "Minh"],
        ])
        expect(em.find).toHaveBeenCalledWith(AgentConnectionEntity, {
            where: { workspaceId: "w1", purpose: In(["inbound_chat", "outbound_chat", "lead_source"]) },
            order: { createdAt: "ASC" },
            take: 500,
        })
    })
})

describe("ChannelOwnersService > conflictOf", () => {
    it("names the agent that already answers the channel for a second agent of the same role", async () => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, LINKS.slice(0, 2)] })
        const { service } = await build(em)

        const conflict = await service.conflictOf("w1", "tg1", {
            agentId: "s-new",
            module: "sales",
            purpose: "outbound_chat",
            access: "ask",
        })

        expect(conflict?.agentName).toBe("Lan")
    })

    it("finds no conflict for the owner itself, a read-only claim or another role", async () => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, LINKS.slice(0, 2)] })
        const { service } = await build(em)

        await expect(
            service.conflictOf("w1", "tg1", {
                agentId: "s-lan",
                module: "sales",
                purpose: "outbound_chat",
                access: "auto",
            }),
        ).resolves.toBeNull()
        await expect(
            service.conflictOf("w1", "tg1", {
                agentId: "s-new",
                module: "sales",
                purpose: "outbound_chat",
                access: "read",
            }),
        ).resolves.toBeNull()
        await expect(
            service.conflictOf("w1", "tg1", {
                agentId: "b1",
                module: "booking",
                purpose: "inbound_chat",
                access: "ask",
            }),
        ).resolves.toBeNull()
    })

    it("reads nothing for a claim of a purpose that is no channel", async () => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, LINKS] })
        const { service } = await build(em)

        await expect(
            service.conflictOf("w1", "sepay1", {
                agentId: "a1",
                module: "accounting",
                purpose: "bank_feed",
                access: "auto",
            }),
        ).resolves.toBeNull()
        expect(em.find).not.toHaveBeenCalled()
    })

    it("reads inside the caller's transaction", async () => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, []] })
        const tx = mockEntityManager({ find: [AgentConnectionEntity, LINKS.slice(0, 2)] })
        const { service } = await build(em)

        const conflict = await service.conflictOf(
            "w1",
            "tg1",
            { agentId: "s-new", module: "sales", purpose: "outbound_chat", access: "ask" },
            tx,
        )

        expect(conflict?.agentId).toBe("s-lan")
        expect(em.find).not.toHaveBeenCalled()
    })
})

describe("ChannelOwnersService > requireFree", () => {
    it("refuses a second agent of the same role, naming the agent that answers the channel", async () => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, LINKS.slice(0, 2)] })
        const { service } = await build(em)

        await expect(
            service.requireFree("w1", "tg1", {
                agentId: "s-new",
                module: "sales",
                purpose: "outbound_chat",
                access: "ask",
            }),
        ).rejects.toMatchObject({
            code: AgentConnectionsErrorCode.ChannelOwned,
            params: { agent: "Lan", agentId: "s-lan", connectionId: "tg1" },
        })
    })

    it("lets a claim through when no other agent of the role answers the channel", async () => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, LINKS.slice(0, 2)] })
        const { service } = await build(em)

        await expect(
            service.requireFree("w1", "tg1", {
                agentId: "b1",
                module: "booking",
                purpose: "inbound_chat",
                access: "ask",
            }),
        ).resolves.toBeUndefined()
    })
})

describe("ChannelOwnersService > conflictsOfAgent", () => {
    it("lists the channels a paused agent holds that another active agent of its role answers", async () => {
        const mine = [linkOf("s-paused", "tg1", "outbound_chat", "ask", 6), linkOf("s-paused", "zl9", "outbound_chat", "ask", 7)]
        const em = mockEntityManager()
        em.find.mockResolvedValueOnce(mine).mockResolvedValueOnce(LINKS.slice(0, 3))
        const { service } = await build(em)

        const conflicts = await service.conflictsOfAgent("w1", "s-paused", "sales")

        expect(conflicts.map((entry) => [entry.connectionId, entry.owner.agentId])).toEqual([["tg1", "s-lan"]])
    })

    it("finds nothing for an agent that holds no channel, and ignores a grant that only reads", async () => {
        const em = mockEntityManager()
        em.find.mockResolvedValueOnce([])
        const { service, directory } = await build(em)
        await expect(service.conflictsOfAgent("w1", "s-paused", "sales")).resolves.toEqual([])
        expect(directory.activeCreatedAmong).not.toHaveBeenCalled()

        const reading = mockEntityManager()
        reading.find
            .mockResolvedValueOnce([linkOf("s-paused", "tg1", "outbound_chat", "read", 6)])
            .mockResolvedValueOnce(LINKS.slice(0, 3))
        const second = await build(reading)
        await expect(second.service.conflictsOfAgent("w1", "s-paused", "sales")).resolves.toEqual([])
    })
})
