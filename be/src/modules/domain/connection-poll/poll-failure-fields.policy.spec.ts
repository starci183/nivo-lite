import { Test } from "@nestjs/testing"
import { ZaloError, ZaloErrorCode } from "@modules/integrations/zalo"
import { failureFieldsOf } from "./poll-failure-fields.policy"

const SUBJECT = Symbol("poll-failure-fields.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { failureFieldsOf } }],
    }).compile()
    return moduleRef.get<typeof import("./poll-failure-fields.policy")>(SUBJECT)
}
/** Params named like the credentials of the providers, built from a list so the names are data of the test. */
const CREDENTIAL_PARAMS = Object.fromEntries(
    ["access_token", "refreshToken", "app_secret", "apiKey"].map((name) => [name, "secret-value"]),
)

describe("failureFieldsOf", () => {
    it("carries the code of a domain error and its params: the provider's own code, its reason, the endpoint and the answer", async () => {
        const subject = await build()
        const error = new ZaloError({
            code: ZaloErrorCode.Rejected,
            params: {
                path: "/v2.0/oa/listrecentchat",
                reason: "no permission",
                zaloCode: -224,
                status: 200,
                body: "{}",
            },
        })

        expect(subject.failureFieldsOf(error)).toEqual({
            errorCode: "ZALO_REJECTED",
            path: "/v2.0/oa/listrecentchat",
            reason: "no permission",
            zaloCode: -224,
            status: 200,
            body: "{}",
        })
    })

    it("leaves out anything that looks like a credential", async () => {
        const subject = await build()
        const error = new ZaloError({
            code: ZaloErrorCode.Rejected,
            params: { path: "/x", ...CREDENTIAL_PARAMS },
        })

        expect(subject.failureFieldsOf(error)).toEqual({ errorCode: "ZALO_REJECTED", path: "/x" })
    })

    it("adds nothing for a failure that is not a domain error", async () => {
        const subject = await build()
        expect(subject.failureFieldsOf(new Error("boom"))).toEqual({})
        expect(subject.failureFieldsOf("boom")).toEqual({})
    })
})
