import { Test } from "@nestjs/testing"
import { statusError, isTransientDocumentsError } from "./documents-failure.policy"
import { DocumentsError, DocumentsErrorCode } from "./errors/documents.error"

const SUBJECT = Symbol("documents-failure.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { statusError, isTransientDocumentsError } }],
    }).compile()
    return moduleRef.get<typeof import("./documents-failure.policy")>(SUBJECT)
}

describe("statusError", () => {
    it.each([0, 408, 425, 429, 500, 503])("takes status %s for a failure worth another try", async (status) => {
        const subject = await build()

        expect(subject.statusError(status)).toMatchObject({ code: DocumentsErrorCode.Unavailable, params: { status } })
    })

    it.each([400, 410, 451])("takes status %s for a refusal that will not change", async (status) => {
        const subject = await build()

        expect(subject.statusError(status)).toMatchObject({ code: DocumentsErrorCode.Refused, params: { status } })
    })
})

describe("isTransientDocumentsError", () => {
    it("takes an unavailable documents error for transient", async () => {
        const subject = await build()

        expect(subject.isTransientDocumentsError(subject.statusError(503))).toBe(true)
    })

    it("takes any other documents error for permanent", async () => {
        const subject = await build()

        expect(subject.isTransientDocumentsError(new DocumentsError({ code: DocumentsErrorCode.NotPublic }))).toBe(
            false,
        )
    })

    it.each(["AbortError", "TimeoutError"])("takes a %s for transient", async (name) => {
        const subject = await build()

        expect(subject.isTransientDocumentsError(Object.assign(new Error("cut"), { name }))).toBe(true)
    })

    it("takes a failed fetch for transient", async () => {
        const subject = await build()

        expect(subject.isTransientDocumentsError(new TypeError("fetch failed"))).toBe(true)
    })

    it("takes another type error and another error for permanent", async () => {
        const subject = await build()

        expect(subject.isTransientDocumentsError(new TypeError("undefined is not a function"))).toBe(false)
        expect(subject.isTransientDocumentsError(new Error("boom"))).toBe(false)
    })

    it("takes a value that is not an error for permanent", async () => {
        const subject = await build()

        expect(subject.isTransientDocumentsError("boom")).toBe(false)
    })
})
