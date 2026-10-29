import { Test } from "@nestjs/testing"
import { ObjectStorageError } from "./errors/object-storage.error"
import { MAX_PRESIGN_SECONDS, bucketNameOf, objectKeyOf, presignSecondsOf, publicUrlOf } from "./object-storage.policy"
import type * as policy from "./object-storage.policy"

const SUBJECT = Symbol("storage.policy")

type Subject = Pick<typeof policy, "bucketNameOf" | "objectKeyOf" | "presignSecondsOf" | "publicUrlOf">

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { bucketNameOf, objectKeyOf, presignSecondsOf, publicUrlOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("storage policy / bucketNameOf", () => {
    it("prefixes the purpose per environment and turns underscores into hyphens", async () => {
        const subject = await build()

        expect(subject.bucketNameOf("nivo", "avatars_public")).toBe("nivo-avatars-public")
        expect(subject.bucketNameOf("nivo-dev", "Knowledge-Uploads")).toBe("nivo-dev-knowledge-uploads")
    })

    it.each(["Bad Prefix", "-lead", ""])("refuses the prefix %p", async (prefix) => {
        const subject = await build()

        expect(() => subject.bucketNameOf(prefix, "media")).toThrow(ObjectStorageError)
    })
})

describe("storage policy / objectKeyOf", () => {
    it("keeps a clean relative path as the key", async () => {
        const subject = await build()

        expect(subject.objectKeyOf("ws-1/marketing/a b.png")).toBe("ws-1/marketing/a b.png")
    })

    it.each(["", "/abs", "a//b", "a/../b", "a/./b", "a\b", "a/\u0007b", "a/"])("refuses the path %p", async (path) => {
        const subject = await build()

        expect(() => subject.objectKeyOf(path)).toThrow(ObjectStorageError)
    })
})

describe("storage policy / publicUrlOf", () => {
    it("joins origin, bucket and encoded key segments", async () => {
        const subject = await build()

        expect(subject.publicUrlOf("https://minio.example.org/", "nivo-avatars-public", "people/a b.png")).toBe(
            "https://minio.example.org/nivo-avatars-public/people/a%20b.png",
        )
    })
})

describe("storage policy / presignSecondsOf", () => {
    it.each([
        [60, 60],
        [0, 1],
        [-5, 1],
        [1.9, 1],
        [Number.NaN, 1],
        [MAX_PRESIGN_SECONDS * 2, MAX_PRESIGN_SECONDS],
    ])("turns %p seconds into %p", async (asked, given) => {
        const subject = await build()

        expect(subject.presignSecondsOf(asked)).toBe(given)
    })
})
