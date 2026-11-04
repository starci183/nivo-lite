import { Test } from "@nestjs/testing"
import { ZaloError, ZaloErrorCode } from "@modules/integrations/zalo"
import { deliveryFailureFieldsOf } from "./delivery-failure-fields.policy"

const SUBJECT = Symbol("delivery-failure-fields.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { deliveryFailureFieldsOf } }],
    }).compile()
    return moduleRef.get<{ deliveryFailureFieldsOf: typeof deliveryFailureFieldsOf }>(SUBJECT)
}

describe("deliveryFailureFieldsOf", () => {
    it("carries the code, Zalo's number, its reason, the endpoint and the status, and nothing that names a person or holds a credential", async () => {
        const policy = await build()

        const cause = new ZaloError({
            code: ZaloErrorCode.RecipientUnreachable,
            params: {
                path: "/v3.0/oa/message/cs",
                reason: "user not found",
                zaloCode: -108,
                status: 200,
                body: '{"error":-108,"recipient":"1234567890"}',
                internal: "kept out of the log",
                userId: "1234567890",
            },
        })

        expect(policy.deliveryFailureFieldsOf(cause)).toEqual({
            errorCode: ZaloErrorCode.RecipientUnreachable,
            path: "/v3.0/oa/message/cs",
            reason: "user not found",
            zaloCode: -108,
            status: 200,
        })
    })

    it("adds nothing for a failure that is no domain error", async () => {
        const policy = await build()

        expect(policy.deliveryFailureFieldsOf(new Error("socket hang up"))).toEqual({})
        expect(policy.deliveryFailureFieldsOf("nope")).toEqual({})
    })
})
