import { Test } from "@nestjs/testing"
import { agentMemberOf as memberOf } from "@tests/fixtures/builders/agents.builder"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentIdentityService } from "@modules/domain/agents"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { AvatarAccounts } from "./avatars.contracts"
import { AVATARS_ACCOUNTS, AVATARS_STORAGE } from "./avatars.decorators"
import { AvatarsService } from "./avatars.service"
import { AvatarsErrorCode } from "./errors/avatars.error"

/** The statement `callDbFunction` sends to allocate a picture object name. */
const NEW_AVATAR_OBJECT_ID = "SELECT * FROM gen_random_uuid()"
const ID = "0f8fad5b-d9cb-469f-a165-70867728950e"
const PUBLIC_BASE = "https://s.test/storage/v1/object/public/avatars_public"
const PNG = { contentType: "image/png", sizeBytes: 4096 }

const build = async (
    entityManager: MockEntityManager = mockEntityManager({ query: [NEW_AVATAR_OBJECT_ID, [{ gen_random_uuid: ID }]] }),
) => {
    const storage = mock<StorageObjectsPort>()
    storage.signedUpload.mockImplementation((_bucket, path) =>
        Promise.resolve(ok({ path, token: "t", signedUrl: `https://s.test/upload/${path}` })),
    )
    storage.publicUrl.mockImplementation((_bucket, path) => `${PUBLIC_BASE}/${path}`)
    const accounts = mock<AvatarAccounts>()
    accounts.setUploadedAvatar.mockResolvedValue(ok(true))
    const members = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(memberOf())) })
    const identity = mock<AgentIdentityService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AvatarsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AVATARS_STORAGE, useValue: storage },
            { provide: AVATARS_ACCOUNTS, useValue: accounts },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AgentIdentityService, useValue: identity },
        ],
    }).compile()
    return { service: moduleRef.get(AvatarsService), storage, accounts, members, identity }
}

describe("AvatarsService > uploads", () => {
    it("issues an upload address in the people folder with the public address the picture will have", async () => {
        const { service, storage } = await build()

        await expect(service.requestPersonUpload(PNG)).resolves.toEqual({
            path: `people/${ID}.png`,
            token: "t",
            signedUrl: `https://s.test/upload/people/${ID}.png`,
            publicUrl: `${PUBLIC_BASE}/people/${ID}.png`,
        })
        expect(storage.signedUpload).toHaveBeenCalledWith("avatars_public", `people/${ID}.png`)
    })

    it("issues an agent picture address to a manager only", async () => {
        const { service, members, storage } = await build()

        await expect(
            service.requestAgentUpload("u1", "w1", { contentType: "image/jpeg", sizeBytes: 10 }),
        ).resolves.toMatchObject({ path: `agents/${ID}.jpg` })
        expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])

        const refusal = new Error("staff")
        members.require.mockRejectedValueOnce(refusal)
        await expect(service.requestAgentUpload("u2", "w1", PNG)).rejects.toBe(refusal)
        expect(storage.signedUpload).toHaveBeenCalledTimes(1)
    })

    it("refuses a picture of another type or size before allocating anything", async () => {
        const em = mockEntityManager({ query: [NEW_AVATAR_OBJECT_ID, [{ gen_random_uuid: ID }]] })
        const { service, storage } = await build(em)

        await expect(service.requestPersonUpload({ contentType: "image/gif", sizeBytes: 10 })).rejects.toMatchObject({
            code: AvatarsErrorCode.FileInvalid,
        })
        expect(em.query).not.toHaveBeenCalled()
        expect(storage.signedUpload).not.toHaveBeenCalled()
    })

    it("reports the store unavailable when no id is allocated or Storage refuses", async () => {
        const empty = await build(mockEntityManager({ query: [NEW_AVATAR_OBJECT_ID, []] }))
        await expect(empty.service.requestPersonUpload(PNG)).rejects.toMatchObject({
            code: AvatarsErrorCode.Unavailable,
        })

        const down = await build()
        down.storage.signedUpload.mockResolvedValueOnce(refused("OBJECT_STORAGE_UNAVAILABLE"))
        await expect(down.service.requestPersonUpload(PNG)).rejects.toMatchObject({
            code: AvatarsErrorCode.Unavailable,
        })
    })
})

describe("AvatarsService > a person's picture", () => {
    it("keeps the public HTTPS address of an issued path on the person's account and removes it with null", async () => {
        const { service, accounts } = await build()

        await service.setPersonAvatar("u1", `people/${ID}.png`)
        await service.setPersonAvatar("u1", null)

        expect(accounts.setUploadedAvatar).toHaveBeenNthCalledWith(1, "u1", `${PUBLIC_BASE}/people/${ID}.png`)
        expect(accounts.setUploadedAvatar).toHaveBeenNthCalledWith(2, "u1", null)
    })

    it("refuses a path it did not issue for people, including an agent picture", async () => {
        const { service, accounts } = await build()

        await expect(service.setPersonAvatar("u1", `agents/${ID}.png`)).rejects.toMatchObject({
            code: AvatarsErrorCode.PathInvalid,
        })
        await expect(service.setPersonAvatar("u1", "people/../secret.png")).rejects.toMatchObject({
            code: AvatarsErrorCode.PathInvalid,
        })
        expect(accounts.setUploadedAvatar).not.toHaveBeenCalled()
    })

    it("refuses to keep a picture the store would serve over plain HTTP", async () => {
        const { service, storage, accounts } = await build()
        storage.publicUrl.mockReturnValue(`http://127.0.0.1:54321/people/${ID}.png`)

        await expect(service.setPersonAvatar("u1", `people/${ID}.png`)).rejects.toMatchObject({
            code: AvatarsErrorCode.AddressInsecure,
        })
        expect(accounts.setUploadedAvatar).not.toHaveBeenCalled()
    })

    it("reports the account unavailable when Auth refuses the change", async () => {
        const { service, accounts } = await build()
        accounts.setUploadedAvatar.mockResolvedValue(refused("IDENTITY_ACCOUNT_NOT_FOUND"))

        await expect(service.setPersonAvatar("u1", null)).rejects.toMatchObject({ code: AvatarsErrorCode.Unavailable })
    })
})

describe("AvatarsService > an agent's picture", () => {
    it("sets the public address of an issued agent path through the agent identity, and clears it with null", async () => {
        const { service, identity } = await build()

        await service.setAgentAvatar("u1", "w1", "a1", `agents/${ID}.webp`)
        await service.setAgentAvatar("u1", "w1", "a1", null)

        expect(identity.setAvatar).toHaveBeenNthCalledWith(1, "u1", "w1", "a1", `${PUBLIC_BASE}/agents/${ID}.webp`)
        expect(identity.setAvatar).toHaveBeenNthCalledWith(2, "u1", "w1", "a1", null)
    })

    it("refuses a person's picture path for an agent", async () => {
        const { service, identity } = await build()

        await expect(service.setAgentAvatar("u1", "w1", "a1", `people/${ID}.png`)).rejects.toMatchObject({
            code: AvatarsErrorCode.PathInvalid,
        })
        expect(identity.setAvatar).not.toHaveBeenCalled()
    })
})
