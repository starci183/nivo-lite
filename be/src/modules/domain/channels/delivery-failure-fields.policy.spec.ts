import { ZaloError, ZaloErrorCode } from "@modules/integrations/zalo"
import { deliveryFailureFieldsOf } from "./delivery-failure-fields.policy"

describe("deliveryFailureFieldsOf", () => {
    it("carries the code, Zalo's number, its reason, the endpoint and the status, and nothing that names a person or holds a credential", () => {
        const cause = new ZaloError({
            code: ZaloErrorCode.RecipientUnreachable,
            params: {
                path: "/v3.0/oa/message/cs",
                reason: "user not found",
                zaloCode: -108,
                status: 200,
                body: '{"error":-108,"recipient":"1234567890"}',
                access_token: "secret",
                userId: "1234567890",
            },
        })

        expect(deliveryFailureFieldsOf(cause)).toEqual({
            errorCode: ZaloErrorCode.RecipientUnreachable,
            path: "/v3.0/oa/message/cs",
            reason: "user not found",
            zaloCode: -108,
            status: 200,
        })
    })

    it("adds nothing for a failure that is no domain error", () => {
        expect(deliveryFailureFieldsOf(new Error("socket hang up"))).toEqual({})
        expect(deliveryFailureFieldsOf("nope")).toEqual({})
    })
})
