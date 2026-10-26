import { eachInOrder } from "@modules/platform/primitives"
import {
    OFFICE_MEMBER_AVATAR,
    officeRoomMembersIdentity,
    persistOfficeRoomMembers,
} from "../../fixtures/builders/office-room-members.builder"
import { CLEAN_USERS } from "../../fixtures/persistence/office-chain.sql"
import { READ_ROOM_MEMBER_AVATARS } from "../../fixtures/persistence/office-room-members.sql"
import {
    BROWSER_WRITE_AVATAR,
    ENTER_BROWSER_ROLE,
    READ_AVATARS_BUCKET,
    READ_AVATARS_POLICIES,
    USE_BROWSER_ROLE,
    WRITE_UPLOADED_AVATAR,
} from "../../fixtures/persistence/profile-avatars.sql"
import { CLEAN_WORKSPACE } from "../../fixtures/persistence/proof.sql"
import { withBackendRole } from "../../world/backend-role-proof.service"
import { OfficeRoomMembersProofModule } from "../../world/office-room-members-proof.module"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: [OfficeRoomMembersProofModule.register()] })
const identity = officeRoomMembersIdentity(() => world.id())
const UPLOADED = "https://cdn.example.test/storage/v1/object/public/avatars_public/people/one.png"

/** The helper's only Auth output: account id and picture. */
interface MemberAvatarRow {
    /** The requested active workspace account. */
    readonly id: string
    /** The picture the team sees, when it is an HTTPS address. */
    readonly avatar_url: string | null
}

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
    await world.db.primary.query(WRITE_UPLOADED_AVATAR, [identity.userIds[0], UPLOADED])
    await world.db.primary.query(WRITE_UPLOADED_AVATAR, [identity.userIds[1], UPLOADED])
    await world.db.primary.query(WRITE_UPLOADED_AVATAR, [identity.userIds[2], "http://cdn.example.test/plain.png"])
})

describe("uploaded member pictures over PostgreSQL", () => {
    it("shows the uploaded HTTPS picture before the provider photo and ignores a plain HTTP upload", async () => {
        await withBackendRole(world, async (tx) => {
            const rows = await tx.query<Array<MemberAvatarRow>>(READ_ROOM_MEMBER_AVATARS, [
                identity.workspaceId,
                [identity.userIds[0], identity.userIds[1], identity.userIds[2], identity.foreignUserId],
            ])

            const byId = new Map(rows.map((row) => [row.id, row.avatar_url]))

            expect(rows).toHaveLength(3)
            expect(byId.get(identity.userIds[0])).toBe(UPLOADED)
            expect(byId.get(identity.userIds[1])).toBe(UPLOADED)
            expect(byId.get(identity.userIds[2])).toBeNull()
        })
    })

    it("falls back to the provider photo once the upload is removed", async () => {
        await world.db.primary.query(WRITE_UPLOADED_AVATAR, [identity.userIds[0], null])
        await withBackendRole(world, async (tx) => {
            const rows = await tx.query<Array<MemberAvatarRow>>(READ_ROOM_MEMBER_AVATARS, [
                identity.workspaceId,
                [identity.userIds[0]],
            ])

            expect(rows).toEqual([{ id: identity.userIds[0], avatar_url: OFFICE_MEMBER_AVATAR }])
        })
    })
})

describe("the avatars bucket over PostgreSQL", () => {
    it("bounds the bucket to PNG, JPEG and WebP of at most 2 MB and lets browsers only read it", async () => {
        await expect(world.db.primary.query(READ_AVATARS_BUCKET)).resolves.toEqual([
            {
                public: true,
                file_size_limit: "2097152",
                allowed_mime_types: ["image/png", "image/jpeg", "image/webp"],
            },
        ])
        await expect(world.db.primary.query(READ_AVATARS_POLICIES)).resolves.toEqual([
            { policyname: "objects_public_read", cmd: "SELECT", roles: ["anon", "authenticated"] },
        ])
    })

    it("refuses a signed-in browser that writes into the bucket itself", async () => {
        const runner = world.db.primary.connection.createQueryRunner()
        try {
            await runner.connect()
            await runner.startTransaction()
            await runner.manager.query(ENTER_BROWSER_ROLE)
            await runner.manager.query(USE_BROWSER_ROLE)
            await expect(runner.manager.query(BROWSER_WRITE_AVATAR, ["people/forged.png"])).rejects.toMatchObject({
                code: "42501",
            })
        } finally {
            if (runner.isTransactionActive) await runner.rollbackTransaction()
            await runner.release()
        }
    })
})
