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
    /** Its public provider photo, when the metadata holds a string. */
    readonly avatar_url: string | null
}

beforeAll(async () => {
    world.cleanup(async () => {
        await eachInOrder([identity.workspaceId, identity.foreignWorkspaceId], async (workspaceId) => {
            await world.db.primary.query(CLEAN_WORKSPACE, [workspaceId])
        })
        await world.db.primary.query(CLEAN_USERS, [[identity.ownerId, ...identity.userIds, identity.foreignUserId]])
    })
    await persistOfficeRoomMembers(world.db.primary, identity)
})

describe("office group member previews over PostgreSQL", () => {
    it("counts active people and all seated agents and bounds each group to four deterministic previews", async () => {
        const rooms = await world.resolve(OfficeRoomsService).rooms(identity.ownerId, identity.workspaceId)

        expect(rooms.map((room) => room.key)).toEqual([null, "sales", "marketing"])
        expect(rooms[0]?.members).toEqual({
            count: 9,
            preview: [
                { name: "Agent 1", avatarUrl: null },
                { name: "Person 1", avatarUrl: OFFICE_MEMBER_AVATAR },
                { name: "Person 2", avatarUrl: null },
                { name: "Person 3", avatarUrl: null },
            ],
        })
        expect(rooms[1]?.members).toEqual({
            count: 7,
            preview: [
                { name: "Person 1", avatarUrl: OFFICE_MEMBER_AVATAR },
                { name: "Agent 1", avatarUrl: null },
                { name: "Person 2", avatarUrl: null },
                { name: "Person 3", avatarUrl: null },
            ],
        })
        expect(rooms[2]?.members).toEqual({ count: 0, preview: [] })
        await expect(world.resolve(OfficeRoomsService).rooms(identity.ownerId, identity.workspaceId)).resolves.toEqual(
            rooms,
        )
    })

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

    it("exposes only requested active workspace provider photos through the server-only projection", async () => {
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
