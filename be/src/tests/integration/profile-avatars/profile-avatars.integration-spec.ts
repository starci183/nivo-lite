import { eachInOrder } from "@modules/platform/primitives"
import {
    OFFICE_MEMBER_AVATAR,
    officeRoomMembersIdentity,
    persistOfficeRoomMembers,
} from "../../fixtures/builders/office-room-members.builder"
import { withBackendRole } from "../../world/backend-role-proof.service"
import { OfficeRoomMembersProofModule } from "../../world/office-room-members-proof.module"
import { useTestWorld } from "../../world/use-test-world"
import {
    roomMemberAvatars,
    avatarsBucket,
    avatarsPolicies,
    withBrowserRole,
    browserWriteAvatar,
} from "../../world/avatars-database.service"
import { removeAuthUsers, removeWorkspace, storeUploadedAvatar } from "../../world/proof-accounts.service"

const world = useTestWorld({ modules: [OfficeRoomMembersProofModule.register()] })
const identity = officeRoomMembersIdentity(() => world.id())
const UPLOADED = "https://cdn.example.test/storage/v1/object/public/avatars_public/people/one.png"

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
    await storeUploadedAvatar(world.db.primary, identity.userIds[0], UPLOADED)
    await storeUploadedAvatar(world.db.primary, identity.userIds[1], UPLOADED)
    await storeUploadedAvatar(world.db.primary, identity.userIds[2], "http://cdn.example.test/plain.png")
})

describe("uploaded member pictures over PostgreSQL", () => {
    it("shows the uploaded HTTPS picture before the provider photo and ignores a plain HTTP upload", async () => {
        await withBackendRole(world, async (tx) => {
            const rows = await roomMemberAvatars(tx, identity.workspaceId, [
                identity.userIds[0],
                identity.userIds[1],
                identity.userIds[2],
                identity.foreignUserId,
            ])

            const byId = new Map(rows.map((row) => [row.id, row.avatar_url]))

            expect(rows).toHaveLength(3)
            expect(byId.get(identity.userIds[0])).toBe(UPLOADED)
            expect(byId.get(identity.userIds[1])).toBe(UPLOADED)
            expect(byId.get(identity.userIds[2])).toBeNull()
        })
    })

    it("falls back to the provider photo once the upload is removed", async () => {
        await storeUploadedAvatar(world.db.primary, identity.userIds[0], null)
        await withBackendRole(world, async (tx) => {
            const rows = await roomMemberAvatars(tx, identity.workspaceId, [identity.userIds[0]])

            expect(rows).toEqual([{ id: identity.userIds[0], avatar_url: OFFICE_MEMBER_AVATAR }])
        })
    })
})

describe("the avatars bucket over PostgreSQL", () => {
    it("bounds the bucket to PNG, JPEG and WebP of at most 2 MB and lets browsers only read it", async () => {
        await expect(avatarsBucket(world.db.primary)).resolves.toEqual([
            {
                public: true,
                file_size_limit: "2097152",
                allowed_mime_types: ["image/png", "image/jpeg", "image/webp"],
            },
        ])
        await expect(avatarsPolicies(world.db.primary)).resolves.toEqual([
            { policyname: "objects_public_read", cmd: "SELECT", roles: ["anon", "authenticated"] },
        ])
    })

    it("refuses a signed-in browser that writes into the bucket itself", async () => {
        await withBrowserRole(world, async (tx) => {
            await expect(browserWriteAvatar(tx, "people/forged.png")).rejects.toMatchObject({ code: "42501" })
        })
    })
})
