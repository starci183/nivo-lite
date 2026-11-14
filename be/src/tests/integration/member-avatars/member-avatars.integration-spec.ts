import { eachInOrder } from "@modules/platform/primitives"
import {
    MEMBER_PROVIDER_AVATAR,
    memberAvatarsIdentity,
    persistMemberAvatars,
} from "../../fixtures/builders/member-avatars.builder"
import { withBackendRole } from "../../world/backend-role-proof.service"
import { useTestWorld } from "../../world/use-test-world"
import {
    roomMemberAvatars,
    writeAgentAvatar,
    agentAvatarPrivileges,
    roomMemberAvatarPrivileges,
} from "../../world/avatars-database.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"

const world = useTestWorld({ modules: [] })
const identity = memberAvatarsIdentity(() => world.id())

beforeAll(async () => {
    world.cleanup(async () => {
        await eachInOrder([identity.workspaceId, identity.foreignWorkspaceId], async (workspaceId) => {
            await removeWorkspace(world.db.primary, workspaceId)
        })
        await removeAuthUsers(world.db.primary, [identity.ownerId, ...identity.userIds, identity.foreignUserId])
    })
    await persistMemberAvatars(world.db.primary, identity)
})

describe("member picture helper over PostgreSQL", () => {
    it("returns null for HTTP, JavaScript and non-string photos and exposes only requested active workspace accounts", async () => {
        await withBackendRole(world, async (tx) => {
            const rows = await roomMemberAvatars(tx, identity.workspaceId, [
                ...identity.userIds,
                identity.foreignUserId,
            ])

            expect(rows).toEqual([
                { id: identity.userIds[0], avatar_url: MEMBER_PROVIDER_AVATAR },
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
