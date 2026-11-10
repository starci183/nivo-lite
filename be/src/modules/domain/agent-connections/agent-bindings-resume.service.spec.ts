import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentBindingsService } from "./agent-bindings.service"
import { BINDING_AGENTS } from "./agent-connections.decorators"
import type { BindingAgentsDirectory } from "./agent-connections.port"
import { ChannelOwnersService } from "./channel-owners.service"
import { AgentConnectionsErrorCode } from "./errors/agent-connections.error"
import { AgentConnectionEntity } from "./persistence/entities"

const AGENT = { id: "a1", name: "Minh", module: "sales" }

const LAN = {
    connectionId: "c1",
    agentId: "a2",
    agentName: "Lan",
    module: "sales",
    purpose: "outbound_chat" as const,
    access: "ask" as const,
    grantedAt: new Date("2026-11-01T00:00:00.000Z"),
}

const BOT = {
    id: "c1",
    provider: "telegram",
    name: "Shop bot",
    status: "connected",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    botUsername: null,
    accountMasked: null,
}

const build = async (entityManager: MockEntityManager, conflicts = true) => {
    const connections = mock<ConnectionBindingsReadService>()
    connections.factsOf.mockResolvedValue([BOT])
    const channelOwners = mock<ChannelOwnersService>()
    channelOwners.conflictsOfAgent.mockResolvedValue(conflicts ? [{ connectionId: "c1", owner: LAN }] : [])
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentBindingsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: mock<WorkspaceMembersService>() },
            { provide: BINDING_AGENTS, useValue: mock<BindingAgentsDirectory>() },
            { provide: ConnectionBindingsReadService, useValue: connections },
            { provide: ChannelOwnersService, useValue: channelOwners },
        ],
    }).compile()
    return { service: moduleRef.get(AgentBindingsService), channelOwners }
}

describe("AgentBindingsService > resumeConflictsOf", () => {
    it("lists the channels another agent of the role answers now, with their names", async () => {
        const { service, channelOwners } = await build(mockEntityManager())

        await expect(service.resumeConflictsOf("w1", "a1", "sales")).resolves.toEqual([
            { connectionId: "c1", connectionName: "Shop bot", owner: LAN },
        ])
        expect(channelOwners.conflictsOfAgent).toHaveBeenCalledWith("w1", "a1", "sales")
    })

    it("answers nothing, and reads no connection, when no channel would have two agents", async () => {
        const { service } = await build(mockEntityManager(), false)

        await expect(service.resumeConflictsOf("w1", "a1", "sales")).resolves.toEqual([])
    })
})

describe("AgentBindingsService > requireResumeChoice", () => {
    it("resumes freely when no channel would have two agents", async () => {
        const { service } = await build(mockEntityManager(), false)

        await expect(service.requireResumeChoice("w1", AGENT, null)).resolves.toEqual([])
    })

    it("refuses to silently double-own: a conflict names the channels and who answers them", async () => {
        const { service } = await build(mockEntityManager())

        await expect(service.requireResumeChoice("w1", AGENT, null)).rejects.toMatchObject({
            code: AgentConnectionsErrorCode.ResumeConflict,
            params: { agent: "Minh", channels: "Shop bot", connectionIds: "c1", owners: "Lan" },
        })
    })

    it.each(["resumed", "current"] as const)("lets a resume through once the caller chose to keep %s", async (keep) => {
        const { service } = await build(mockEntityManager())

        await expect(service.requireResumeChoice("w1", AGENT, keep)).resolves.toHaveLength(1)
    })
})

describe("AgentBindingsService > settleResume", () => {
    const settle = async (keep: "resumed" | "current" | null, withConflict = true) => {
        const em = mockEntityManager({ delete: [AgentConnectionEntity, { affected: 1 }] })
        fakeTransaction(em)
        const { service } = await build(em)
        const conflicts = withConflict ? await service.resumeConflictsOf("w1", "a1", "sales") : []
        await service.settleResume("w1", "a1", conflicts, keep)
        return em
    }

    it("keeping the current agent drops the resumed agent's grant on those channels", async () => {
        const em = await settle("current")

        expect(em.delete).toHaveBeenCalledTimes(1)
        expect(em.delete).toHaveBeenCalledWith(AgentConnectionEntity, {
            agentId: "a1",
            connectionId: "c1",
            workspaceId: "w1",
        })
    })

    it("keeping the resumed agent takes the channels from the agent that answers them now", async () => {
        const em = await settle("resumed")

        expect(em.delete).toHaveBeenCalledTimes(1)
        expect(em.delete).toHaveBeenCalledWith(AgentConnectionEntity, {
            agentId: "a2",
            connectionId: "c1",
            workspaceId: "w1",
        })
    })

    it("settles nothing without a choice or without a conflict", async () => {
        const noChoice = await settle(null)
        const noConflict = await settle("current", false)

        expect(noChoice.delete).not.toHaveBeenCalled()
        expect(noConflict.delete).not.toHaveBeenCalled()
    })
})
