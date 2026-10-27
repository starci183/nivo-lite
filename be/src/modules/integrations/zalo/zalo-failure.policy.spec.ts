import { Test } from "@nestjs/testing"
import { ZaloError, ZaloErrorCode } from "./errors/zalo.error"
import { isZaloRefusal, isZaloTokenRejection, zaloErrorCodeOf, zaloFailureOf } from "./zalo-failure.policy"

const SUBJECT = Symbol("zalo-failure.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { zaloFailureOf, zaloErrorCodeOf, isZaloTokenRejection, isZaloRefusal } },
        ],
    }).compile()
    return moduleRef.get<typeof import("./zalo-failure.policy")>(SUBJECT)
}

const refused = (zaloCode?: number) =>
    new ZaloError({
        code: ZaloErrorCode.Rejected,
        params: { path: "/v3.0/oa/message/cs", reason: "no", ...(zaloCode === undefined ? {} : { zaloCode }) },
    })

describe("zalo-failure policy", () => {
    describe("zaloFailureOf", () => {
        it.each([
            [-230, "zalo_window_expired"],
            [-232, "zalo_window_expired"],
            [-213, "zalo_unfollowed"],
            [-234, "zalo_night_hours"],
            [-216, "zalo_token"],
            [-124, "zalo_token"],
            [-14014, "zalo_token"],
            [-14003, "zalo_token"],
            [-108, "zalo_recipient"],
            [-114, "zalo_recipient"],
            [-109, "zalo_template"],
            [-112, "zalo_template"],
            [-115, "zalo_quota"],
            [-144, "zalo_quota"],
            [-117, "zalo_not_permitted"],
            [-133, "zalo_night_hours"],
            [-1, "zalo_error"],
        ])("maps the Zalo error %s to %s", async (code, failure) => {
            const subject = await buildSubject()

            expect(subject.zaloFailureOf(refused(code))).toBe(failure)
        })

        it("maps a failure without a numeric error and a foreign error to the generic failure", async () => {
            const subject = await buildSubject()

            expect(subject.zaloFailureOf(refused())).toBe("zalo_error")
            expect(subject.zaloFailureOf(new Error("boom"))).toBe("zalo_error")
        })

        it("reads a classified error that carries no numeric error by its code", async () => {
            const subject = await buildSubject()

            expect(subject.zaloFailureOf(new ZaloError({ code: ZaloErrorCode.TemplateRejected }))).toBe("zalo_template")
            expect(subject.zaloFailureOf(new ZaloError({ code: ZaloErrorCode.Unavailable }))).toBe("zalo_error")
        })
    })

    describe("zaloErrorCodeOf", () => {
        it("classifies the listed numbers and leaves an unlisted one a plain rejection", async () => {
            const subject = await buildSubject()

            expect(subject.zaloErrorCodeOf(-230)).toBe(ZaloErrorCode.WindowClosed)
            expect(subject.zaloErrorCodeOf(-216)).toBe(ZaloErrorCode.TokenRejected)
            expect(subject.zaloErrorCodeOf(-139)).toBe(ZaloErrorCode.RecipientUnreachable)
            expect(subject.zaloErrorCodeOf(-5)).toBe(ZaloErrorCode.Rejected)
        })
    })

    describe("isZaloTokenRejection", () => {
        it("is true only for the two errors that mean the access token is bad", async () => {
            const subject = await buildSubject()

            expect(subject.isZaloTokenRejection(refused(-216))).toBe(true)
            expect(subject.isZaloTokenRejection(refused(-124))).toBe(true)
            expect(subject.isZaloTokenRejection(refused(-230))).toBe(false)
            expect(subject.isZaloTokenRejection(new Error("boom"))).toBe(false)
        })
    })

    describe("isZaloRefusal", () => {
        it("is true when Zalo answered and said no, false when it did not answer or the error is foreign", async () => {
            const subject = await buildSubject()

            expect(subject.isZaloRefusal(refused(-1))).toBe(true)
            expect(subject.isZaloRefusal(new ZaloError({ code: ZaloErrorCode.Unavailable }))).toBe(false)
            expect(subject.isZaloRefusal(new Error("boom"))).toBe(false)
        })
    })
})
