import { OfficeRoomsService } from "@modules/domain/office-rooms"
import { eachInOrder } from "@modules/platform/primitives"
import {
    OFFICE_MEMBER_AVATAR,
    officeRoomMembersIdentity,
    persistOfficeRoomMembers,
} from "../../fixtures/builders/office-room-members.builder"
import { CLEAN_USERS } from "../../fixtures/persistence/office-chain.sql"
import {
    READ_ROOM_MEMBER_AVATARS,
    ROOM_MEMBER_AVATAR_PRIVILEGES,
} from "../../fixtures/persistence/office-room-members.sql"
import { CLEAN_WORKSPACE } from "../../fixtures/persistence/proof.sql"
import { withBackendRole } from "../../world/backend-role-proof.service"
import { OfficeRoomMembersProofModule } from "../../world/office-room-members-proof.module"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: [OfficeRoomMembersProofModule.register()] })
const identity = officeRoomMembersIdentity(() => world.id())

/** The restricted helper's only Auth output: account id and provider photo. */
interface MemberAvatarRow {
    /** The requested active workspace account. */
    readonly id: string
    /** Its public provider photo, when the metadata holds an HTTPS URL. */
    readonly avatar_url: string | null
}

const human = (id: string, name: string, avatarUrl: string | null = null) => ({
    id,
    kind: "human",
    module: null,
    name,
    avatarUrl,
})

const agent = (id: string, name: string) => ({ id, kind: "agent", module: "sales", name, avatarUrl: null })

beforeAll(async () => {
    world.cleanup(async () => {
        await eachInOrder([identity.workspaceId, identity.foreignWorkspaceId], async (workspaceId) => {
            await world.db.primary.query(CLEAN_WORKSPACE, [workspaceId])
        })
        await world.db.primary.query(CLEAN_USERS, [
            [identity.ownerId, identity.managerId, ...identity.userIds, identity.foreignUserId],
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
                agent(identity.agentIds[0], "Agent 1"),
                human(identity.userIds[0], "Person 1", OFFICE_MEMBER_AVATAR),
                human(identity.userIds[1], "Person 2"),
                human(identity.userIds[2], "Person 3"),
            ],
        })
        expect(rooms[1]?.members).toEqual({
            count: 7,
            preview: [
                human(identity.userIds[0], "Person 1", OFFICE_MEMBER_AVATAR),
                agent(identity.agentIds[0], "Agent 1"),
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
            const rows = await tx.query<Array<MemberAvatarRow>>(READ_ROOM_MEMBER_AVATARS, [
                identity.workspaceId,
                [...identity.userIds, identity.foreignUserId],
            ])

            expect(rows).toEqual([
                { id: identity.userIds[0], avatar_url: OFFICE_MEMBER_AVATAR },
                { id: identity.userIds[1], avatar_url: null },
                { id: identity.userIds[2], avatar_url: null },
                { id: identity.userIds[3], avatar_url: null },
            ])
        })
        await expect(world.db.primary.query(ROOM_MEMBER_AVATAR_PRIVILEGES)).resolves.toEqual([
            { backend: true, anonymous: false, browser: false, auth_table: false },
        ])
    })
})
