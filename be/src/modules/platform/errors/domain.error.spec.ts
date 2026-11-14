import { Test } from "@nestjs/testing"
import { DomainError as SharedDomainError, isDomainError as sharedIsDomainError } from "@starci/common"
import { DomainError, isDomainError } from "./domain.error"
import { ErrorsError, ErrorsErrorCode } from "./errors/errors.error"

const SUBJECT = Symbol("domain.error")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { DomainError, isDomainError } }],
    }).compile()
    return moduleRef.get<typeof import("./domain.error")>(SUBJECT)
}

/** A spec-local error of a package built on the shared base, as `@starci/ai-router`'s errors are. */
class PackageError extends SharedDomainError<"PACKAGE_UNAVAILABLE"> {}

describe("DomainError", () => {
    it("is the shared base of @starci/common, so an app family and a package's errors are one kind of error", async () => {
        const subject = await buildSubject()
        const own = new ErrorsError({ code: ErrorsErrorCode.Internal })
        const fromPackage = new PackageError({ code: "PACKAGE_UNAVAILABLE", params: { name: "work" } })

        expect(subject.DomainError).toBe(SharedDomainError)
        expect(subject.isDomainError).toBe(sharedIsDomainError)
        expect(own).toBeInstanceOf(SharedDomainError)
        expect(subject.isDomainError(fromPackage)).toBe(true)
        expect(fromPackage).toMatchObject({ name: "PackageError", code: "PACKAGE_UNAVAILABLE", message: "PACKAGE_UNAVAILABLE", params: { name: "work" } })
        expect(subject.isDomainError(new Error("plain"))).toBe(false)
    })
})
