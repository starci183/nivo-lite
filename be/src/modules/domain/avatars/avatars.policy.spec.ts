import { Test } from "@nestjs/testing"
import { AVATAR_MAX_BYTES, avatarExtensionOf, avatarPathOf, isAvatarPath, isHttpsAddress } from "./avatars.policy"

type Subject = {
    avatarExtensionOf: typeof avatarExtensionOf
    avatarPathOf: typeof avatarPathOf
    isAvatarPath: typeof isAvatarPath
    isHttpsAddress: typeof isHttpsAddress
}

const SUBJECT = Symbol("avatars.policy")
const ID = "0f8fad5b-d9cb-469f-a165-70867728950e"

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { avatarExtensionOf, avatarPathOf, isAvatarPath, isHttpsAddress } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("avatars policy", () => {
    it("accepts PNG, JPEG and WebP pictures of at most 2 MB and names their extension", async () => {
        const subject = await buildSubject()

        expect(subject.avatarExtensionOf({ contentType: "image/png", sizeBytes: 1 })).toBe("png")
        expect(subject.avatarExtensionOf({ contentType: "image/jpeg", sizeBytes: AVATAR_MAX_BYTES })).toBe("jpg")
        expect(subject.avatarExtensionOf({ contentType: "image/webp", sizeBytes: 2048 })).toBe("webp")
    })

    it("refuses other types, empty, fractional and oversized files", async () => {
        const subject = await buildSubject()

        expect(subject.avatarExtensionOf({ contentType: "image/gif", sizeBytes: 10 })).toBeNull()
        expect(subject.avatarExtensionOf({ contentType: "image/svg+xml", sizeBytes: 10 })).toBeNull()
        expect(subject.avatarExtensionOf({ contentType: "image/png", sizeBytes: 0 })).toBeNull()
        expect(subject.avatarExtensionOf({ contentType: "image/png", sizeBytes: 1.5 })).toBeNull()
        expect(subject.avatarExtensionOf({ contentType: "image/png", sizeBytes: AVATAR_MAX_BYTES + 1 })).toBeNull()
    })

    it("names a picture by its owner folder and a fresh id only", async () => {
        const subject = await buildSubject()

        expect(subject.avatarPathOf("people", ID, "png")).toBe(`people/${ID}.png`)
        expect(subject.avatarPathOf("agents", ID, "webp")).toBe(`agents/${ID}.webp`)
    })

    it("recognises only the paths it issues for the owner's folder", async () => {
        const subject = await buildSubject()

        expect(subject.isAvatarPath("people", `people/${ID}.jpg`)).toBe(true)
        expect(subject.isAvatarPath("agents", `people/${ID}.jpg`)).toBe(false)
        expect(subject.isAvatarPath("people", `people/${ID}.gif`)).toBe(false)
        expect(subject.isAvatarPath("people", `people/../${ID}.png`)).toBe(false)
        expect(subject.isAvatarPath("people", `people/x/${ID}.png`)).toBe(false)
        expect(subject.isAvatarPath("people", "people")).toBe(false)
        expect(subject.isAvatarPath("people", `people/${ID.toUpperCase()}.png`)).toBe(false)
    })

    it("keeps HTTPS addresses only", async () => {
        const subject = await buildSubject()

        expect(subject.isHttpsAddress("https://s.test/a.png")).toBe(true)
        expect(subject.isHttpsAddress("http://127.0.0.1:54321/a.png")).toBe(false)
    })
})
