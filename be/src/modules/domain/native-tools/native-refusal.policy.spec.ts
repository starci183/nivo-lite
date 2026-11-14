import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ToolsErrorCode } from "@modules/domain/tools"
import { NATIVE_REFUSAL_CLASS, nativeRefusal } from "./native-refusal.policy"

const SUBJECT = Symbol("native-refusal.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<typeof import("./native-refusal.policy")>({ nativeRefusal, NATIVE_REFUSAL_CLASS }) }],
    }).compile()
    return moduleRef.get<typeof import("./native-refusal.policy")>(SUBJECT)
}

describe("nativeRefusal", () => {
    it("is the expected refusal the gateway answers as a tool error, with its reason", async () => {
        const subject = await build()

        expect(subject.nativeRefusal("not_connected")).toMatchObject({
            code: ToolsErrorCode.NativeRefused,
            params: { reason: "not_connected", refusalClass: "infrastructure" },
        })
    })

    it("carries the class its source gives each reason: a business answer the node reads, or infrastructure that freezes", async () => {
        const subject = await build()

        expect(subject.nativeRefusal("other_lead").params).toEqual({ reason: "other_lead", refusalClass: "business" })
        const business = Object.entries(subject.NATIVE_REFUSAL_CLASS)
            .filter(([, kind]) => kind === "business")
            .map(([reason]) => reason)
        expect(business.sort()).toEqual(
            [
                "account_missing",
                "contact_missing",
                "customer_not_linked",
                "identity_invalid",
                "identity_taken",
                "no_proof",
                "not_found",
                "other_contact",
                "other_conversation",
                "other_customer",
                "other_lead",
                "quote_not_said",
                "same_contact",
                "token_invalid",
            ].sort(),
        )
        expect(subject.NATIVE_REFUSAL_CLASS.not_connected).toBe("infrastructure")
    })
})
