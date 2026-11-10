import { Test } from "@nestjs/testing"
import { openAgentOf, roomlessOpenAgent } from "@tests/fixtures/builders/agents.builder"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import {
    WorkspaceMemberDirectoryService,
    WorkspaceMemberSeatsService,
    WorkspaceMembersService,
} from "@modules/domain/workspace-members"
import type { MemberSeatRecord } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AGENTS_ROOMS } from "./agents.decorators"
import type { AgentRooms } from "./agents.port"
import { AgentOwnershipService } from "./agent-ownership.service"
import { AgentEntity } from "./persistence/entities"

const seatOf = builder<MemberSeatRecord>({
    memberId: "m-mgr",
    userId: "u-lan",
    role: "manager",
    displayName: "Minh",
    status: "active",
})

/** The seat of the caller (null for an account with no active seat) and the rooms they sit in. */
const build = async (entityManager: MockEntityManager, seat: MemberSeatRecord | null) => {
    const rooms = mock<AgentRooms>({
        labelsOf: jest.fn(() => Promise.resolve([])),
        seatRoomsOf: jest.fn(() => Promise.resolve([{ userId: "u-lan", key: "sales" }])),
    })
    const seats = mock<WorkspaceMemberSeatsService>()
    seats.activeSeatOfUser.mockResolvedValue(seat)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentOwnershipService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: mock<WorkspaceMembersService>() },
            { provide: AGENTS_ROOMS, useValue: rooms },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: WorkspaceMemberDirectoryService, useValue: mock<WorkspaceMemberDirectoryService>() },
        ],
    }).compile()
    return { service: moduleRef.get(AgentOwnershipService), seats }
}

describe("AgentOwnershipService canManage", () => {
    it("admits a manager of a role the agent is open to, without needing a room", async () => {
        const em = mockEntityManager({ findOne: [AgentEntity, roomlessOpenAgent()] })
        const { service, seats } = await build(em, seatOf())

        await expect(service.canManage("w1", "u-lan", "a1")).resolves.toBe(true)
        expect(em.findOne).toHaveBeenCalledWith(AgentEntity, { where: { id: "a1", workspaceId: "w1" } })
        expect(seats.activeSeatOfUser).toHaveBeenCalledWith("w1", "u-lan")
    })

    it("admits a manager who sits in a room the agent is open to, though the agent is not open to managers", async () => {
        const em = mockEntityManager({ findOne: [AgentEntity, openAgentOf({ assignableRoles: ["owner"] })] })
        const { service } = await build(em, seatOf())

        await expect(service.canManage("w1", "u-lan", "a1")).resolves.toBe(true)
    })

    it("refuses a manager outside the rooms and roles the agent is open to", async () => {
        const outside = openAgentOf({ assignableRoles: ["owner"], assignableRooms: ["ops"] })
        const { service } = await build(mockEntityManager({ findOne: [AgentEntity, outside] }), seatOf())

        await expect(service.canManage("w1", "u-lan", "a1")).resolves.toBe(false)
    })

    it("still admits a manager for a paused agent, so channels can be set before it resumes", async () => {
        const paused = openAgentOf({ status: "paused" })
        const { service } = await build(mockEntityManager({ findOne: [AgentEntity, paused] }), seatOf())

        await expect(service.canManage("w1", "u-lan", "a1")).resolves.toBe(true)
    })

    it("refuses an account without an active seat", async () => {
        const { service } = await build(mockEntityManager({ findOne: [AgentEntity, openAgentOf()] }), null)

        await expect(service.canManage("w1", "ghost", "a1")).resolves.toBe(false)
    })

    it("refuses an agent that is not in the workspace", async () => {
        const { service } = await build(mockEntityManager({ findOne: [AgentEntity, null] }), seatOf())

        await expect(service.canManage("w1", "u-lan", "a-other")).resolves.toBe(false)
    })
})
