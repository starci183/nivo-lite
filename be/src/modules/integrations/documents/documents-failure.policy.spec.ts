import { isTransientDocumentsError, statusError } from "./documents-failure.policy"
import { DocumentsError, DocumentsErrorCode } from "./errors/documents.error"

describe("statusError", () => {
    it.each([0, 408, 425, 429, 500, 503])("takes status %s for a failure worth another try", (status) => {
        expect(statusError(status)).toMatchObject({ code: DocumentsErrorCode.Unavailable, params: { status } })
    })

    it.each([400, 410, 451])("takes status %s for a refusal that will not change", (status) => {
        expect(statusError(status)).toMatchObject({ code: DocumentsErrorCode.Refused, params: { status } })
    })
})

describe("isTransientDocumentsError", () => {
    it("takes an unavailable documents error for transient", () => {
        expect(isTransientDocumentsError(statusError(503))).toBe(true)
    })

    it("takes any other documents error for permanent", () => {
        expect(isTransientDocumentsError(new DocumentsError({ code: DocumentsErrorCode.NotPublic }))).toBe(false)
    })

    it.each(["AbortError", "TimeoutError"])("takes a %s for transient", (name) => {
        expect(isTransientDocumentsError(Object.assign(new Error("cut"), { name }))).toBe(true)
    })

    it("takes a failed fetch for transient", () => {
        expect(isTransientDocumentsError(new TypeError("fetch failed"))).toBe(true)
    })

    it("takes another type error and another error for permanent", () => {
        expect(isTransientDocumentsError(new TypeError("undefined is not a function"))).toBe(false)
        expect(isTransientDocumentsError(new Error("boom"))).toBe(false)
    })

    it("takes a value that is not an error for permanent", () => {
        expect(isTransientDocumentsError("boom")).toBe(false)
    })
})
