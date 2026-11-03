import { ZaloError, ZaloErrorCode } from "@modules/integrations/zalo"
import { failureFieldsOf } from "./poll-failure-fields.policy"

describe("failureFieldsOf", () => {
    it("carries the code of a domain error and its params: the provider's own code, its reason, the endpoint and the answer", () => {
        const error = new ZaloError({
            code: ZaloErrorCode.Rejected,
            params: { path: "/v2.0/oa/listrecentchat", reason: "no permission", zaloCode: -224, status: 200, body: "{}" },
        })

        expect(failureFieldsOf(error)).toEqual({
            errorCode: "ZALO_REJECTED",
            path: "/v2.0/oa/listrecentchat",
            reason: "no permission",
            zaloCode: -224,
            status: 200,
            body: "{}",
        })
    })

    it("leaves out anything that looks like a credential", () => {
        const error = new ZaloError({
            code: ZaloErrorCode.Rejected,
            params: { path: "/x", access_token: "a", refreshToken: "b", app_secret: "c", apiKey: "d" },
        })

        expect(failureFieldsOf(error)).toEqual({ errorCode: "ZALO_REJECTED", path: "/x" })
    })

    it("adds nothing for a failure that is not a domain error", () => {
        expect(failureFieldsOf(new Error("boom"))).toEqual({})
        expect(failureFieldsOf("boom")).toEqual({})
    })
})
