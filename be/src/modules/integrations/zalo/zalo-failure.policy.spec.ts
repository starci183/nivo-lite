import { ZaloError, ZaloErrorCode } from "./errors/zalo.error"
import { isZaloRefusal, isZaloTokenRejection, zaloFailureOf } from "./zalo-failure.policy"

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
            [-1, "zalo_error"],
        ])("maps the Zalo error %s to %s", (code, failure) => {
            expect(zaloFailureOf(refused(code))).toBe(failure)
        })

        it("maps a failure without a numeric error and a foreign error to the generic failure", () => {
            expect(zaloFailureOf(refused())).toBe("zalo_error")
            expect(zaloFailureOf(new Error("boom"))).toBe("zalo_error")
        })
    })

    describe("isZaloTokenRejection", () => {
        it("is true only for the two errors that mean the access token is bad", () => {
            expect(isZaloTokenRejection(refused(-216))).toBe(true)
            expect(isZaloTokenRejection(refused(-124))).toBe(true)
            expect(isZaloTokenRejection(refused(-230))).toBe(false)
            expect(isZaloTokenRejection(new Error("boom"))).toBe(false)
        })
    })

    describe("isZaloRefusal", () => {
        it("is true when Zalo answered and said no, false when it did not answer or the error is foreign", () => {
            expect(isZaloRefusal(refused(-1))).toBe(true)
            expect(isZaloRefusal(new ZaloError({ code: ZaloErrorCode.Unavailable }))).toBe(false)
            expect(isZaloRefusal(new Error("boom"))).toBe(false)
        })
    })
})
