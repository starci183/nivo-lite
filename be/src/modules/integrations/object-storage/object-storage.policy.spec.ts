import { Test } from "@nestjs/testing"
import { ObjectStorageError, ObjectStorageErrorCode } from "./errors/object-storage.error"
import {
    MAX_PRESIGN_SECONDS,
    bucketNameOf,
    presignSecondsOf,
    reportedUploadTypeOf,
    uploadContentTypeOf,
} from "./object-storage.policy"
import type * as policy from "./object-storage.policy"

const SUBJECT = Symbol("storage.policy")

type Subject = Pick<typeof policy, "bucketNameOf" | "presignSecondsOf" | "reportedUploadTypeOf" | "uploadContentTypeOf">

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { bucketNameOf, presignSecondsOf, reportedUploadTypeOf, uploadContentTypeOf },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

/** What a call throws, or undefined when it returns. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (failure) {
        return failure
    }
    return undefined
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
        expect(thrownBy(() => subject.bucketNameOf(prefix, "media"))).toMatchObject({
            code: ObjectStorageErrorCode.BucketInvalid,
        })
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

describe("storage policy / uploadContentTypeOf", () => {
    const admitted = new Map([
        ["pdf", "application/pdf"],
        ["md", "text/markdown"],
    ])

    it("keeps the type of the browser when the kind admits it, ignoring case and parameters", async () => {
        const subject = await build()

        expect(subject.uploadContentTypeOf(admitted, "a.pdf", "Application/PDF; charset=x")).toBe("application/pdf")
    })

    it("names the type from the extension when the browser reports none or one the kind does not admit", async () => {
        const subject = await build()

        expect(subject.uploadContentTypeOf(admitted, "notes.MD", "")).toBe("text/markdown")
        expect(subject.uploadContentTypeOf(admitted, "notes.md", "application/octet-stream")).toBe("text/markdown")
    })

    it.each([
        ["a.exe", ""],
        ["noextension", ""],
        ["a.constructor", ""],
    ])("refuses %p with type %p", async (name, given) => {
        const subject = await build()

        expect(subject.uploadContentTypeOf(admitted, name, given)).toBeNull()
    })
})

describe("storage policy / reportedUploadTypeOf", () => {
    const admitted = new Map([["pdf", "application/pdf"]])

    it("answers the type of the browser when the kind admits it, and none when it does not or the browser says none", async () => {
        const subject = await build()

        expect(subject.reportedUploadTypeOf(admitted, "Application/PDF; charset=x")).toBe("application/pdf")
        expect(subject.reportedUploadTypeOf(admitted, "application/octet-stream")).toBeNull()
        expect(subject.reportedUploadTypeOf(admitted, "")).toBeNull()
    })
})
