import { Test } from "@nestjs/testing"
import { storedAvatarAddress } from "./object-storage-avatar.policy"

const SUBJECT = Symbol("storage-avatar.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { storedAvatarAddress } }],
    }).compile()
    return moduleRef.get<{ storedAvatarAddress: typeof storedAvatarAddress }>(SUBJECT)
}

describe("storedAvatarAddress", () => {
    it("drops an address of the old Supabase Storage so the screens show the generated initials picture", async () => {
        const subject = await build()
        const old = "https://abc.supabase.co/storage/v1/object/public/avatars_public/people/1.png"

        expect(subject.storedAvatarAddress(old)).toBeNull()
    })

    it.each([
        "https://minio.example.org/nivo-avatars-public/people/1.png",
        "https://lh3.googleusercontent.com/a/photo",
    ])("keeps the address %p", async (address) => {
        const subject = await build()

        expect(subject.storedAvatarAddress(address)).toBe(address)
    })

    it.each([[null], ["not a url"]])("answers no picture for %p", async (address) => {
        const subject = await build()

        expect(subject.storedAvatarAddress(address)).toBeNull()
    })
})
