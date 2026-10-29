import { OfficeRoomsService } from "@modules/domain/office-rooms"
import { eachInOrder } from "@modules/platform/primitives"
import {
    OFFICE_AGENT_AVATAR,
    OFFICE_MEMBER_AVATAR,
    officeRoomMembersIdentity,
    persistOfficeRoomMembers,
} from "../../fixtures/builders/office-room-members.builder"
import { withBackendRole } from "../../world/backend-role-proof.service"
import { OfficeRoomMembersProofModule } from "../../world/office-room-members-proof.module"
import { useTestWorld } from "../../world/use-test-world"
import {
    roomMemberAvatars,
    writeAgentAvatar,
    agentAvatarPrivileges,
    roomMemberAvatarPrivileges,
} from "../../world/avatars-database.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"

const world = useTestWorld({ modules: [OfficeRoomMembersProofModule.register()] })
const identity = officeRoomMembersIdentity(() => world.id())

const human = (id: string, name: string, avatarUrl: string | null = null) => ({
    id,
    kind: "human",
    module: null,
    name,
    avatarUrl,
})

const agent = (id: string, name: string, avatarUrl: string | null = null) => ({
    id,
    kind: "agent",
    module: "sales",
    name,
    avatarUrl,
})

beforeAll(async () => {
    world.cleanup(async () => {
        await eachInOrder([identity.workspaceId, identity.foreignWorkspaceId], async (workspaceId) => {
            await removeWorkspace(world.db.primary, workspaceId)
        })
        await removeAuthUsers(world.db.primary, [
            identity.ownerId,
            identity.managerId,
            ...identity.userIds,
            identity.foreignUserId,
        ])
    })
    await persistOfficeRoomMembers(world.db.primary, identity)
})

describe("office group member previews over PostgreSQL", () => {
    it("counts active accounts and all agents, excludes unlinked staff and bounds previews in deterministic order", async () => {
        const rooms = await world.resolve(OfficeRoomsService).rooms(identity.ownerId, identity.workspaceId)

        expect(rooms.map((room) => room.key)).toEqual([null, "sales", "marketing", "care"])
        expect(rooms[0]?.members).toEqual({
            count: 10,
            preview: [
                agent(identity.agentIds[0], "Agent 1", OFFICE_AGENT_AVATAR),
                human(identity.userIds[0], "Person 1", OFFICE_MEMBER_AVATAR),
                human(identity.userIds[1], "Person 2"),
                human(identity.userIds[2], "Person 3"),
            ],
        })
        expect(rooms[1]?.members).toEqual({
            count: 7,
            preview: [
                human(identity.userIds[0], "Person 1", OFFICE_MEMBER_AVATAR),
                agent(identity.agentIds[0], "Agent 1", OFFICE_AGENT_AVATAR),
                human(identity.userIds[1], "Person 2"),
                human(identity.userIds[2], "Person 3"),
            ],
        })
        await expect(world.resolve(OfficeRoomsService).rooms(identity.ownerId, identity.workspaceId)).resolves.toEqual(
            rooms,
        )
    })

    it("falls back to active owners and managers when no active person seats remain", async () => {
        const rooms = await world.resolve(OfficeRoomsService).rooms(identity.ownerId, identity.workspaceId)
        const fallback = {
            count: 2,
            preview: [human(identity.ownerId, "Owner"), human(identity.managerId, "Manager")],
        }

        expect(rooms.find((room) => room.key === "marketing")?.members).toEqual(fallback)
        expect(rooms.find((room) => room.key === "care")?.members).toEqual(fallback)
    })
})

describe("office group membership boundaries over PostgreSQL", () => {
    it("keeps foreign and disabled people out and rejects callers outside the workspace", async () => {
        const foreign = await world
            .resolve(OfficeRoomsService)
            .rooms(identity.foreignUserId, identity.foreignWorkspaceId)

        expect(foreign.map((room) => room.key)).toEqual([null, "sales"])
        expect(foreign[1]?.members?.count).toBe(2)
        expect(foreign[1]?.members?.preview).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: "Foreign agent", avatarUrl: null }),
                expect.objectContaining({ avatarUrl: OFFICE_MEMBER_AVATAR }),
            ]),
        )
        await expect(
            world.resolve(OfficeRoomsService).rooms(identity.foreignUserId, identity.workspaceId),
        ).rejects.toMatchObject({ code: "WORKSPACE_MEMBERS_NOT_MEMBER" })
        await expect(
            world.resolve(OfficeRoomsService).rooms(identity.userIds[4], identity.workspaceId),
        ).rejects.toMatchObject({ code: "WORKSPACE_MEMBERS_NOT_MEMBER" })
    })

    it("returns null for HTTP, JavaScript and non-string photos and exposes only requested active workspace accounts", async () => {
        await withBackendRole(world, async (tx) => {
            const rows = await roomMemberAvatars(tx, identity.workspaceId, [
                ...identity.userIds,
                identity.foreignUserId,
            ])

            expect(rows).toEqual([
                { id: identity.userIds[0], avatar_url: OFFICE_MEMBER_AVATAR },
                { id: identity.userIds[1], avatar_url: null },
                { id: identity.userIds[2], avatar_url: null },
                { id: identity.userIds[3], avatar_url: null },
            ])
        })
        await expect(roomMemberAvatarPrivileges(world.db.primary)).resolves.toEqual([
            { backend: true, anonymous: false, browser: false, auth_table: false },
        ])
    })
})

describe("agent pictures over PostgreSQL", () => {
    it("keeps only HTTPS agent pictures and lets only the backend write them", async () => {
        await withBackendRole(world, async (tx) => {
            await expect(
                writeAgentAvatar(tx, identity.agentIds[1], "http://images.example.test/agent.png"),
            ).rejects.toMatchObject({ code: "23514" })
        })
        await withBackendRole(world, async (tx) => {
            await expect(writeAgentAvatar(tx, identity.agentIds[1], "javascript:alert(1)")).rejects.toMatchObject({
                code: "23514",
            })
        })
        await expect(agentAvatarPrivileges(world.db.primary)).resolves.toEqual([
            { backend: true, anonymous_read: false, browser_read: false, browser_write: false },
        ])
    })
})
