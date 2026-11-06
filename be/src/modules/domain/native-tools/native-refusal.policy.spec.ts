import { Test } from "@nestjs/testing"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { nativeRefusal } from "./native-refusal.policy"

const SUBJECT = Symbol("native-refusal.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { nativeRefusal } }],
    }).compile()
    return moduleRef.get<typeof import("./native-refusal.policy")>(SUBJECT)
}

describe("nativeRefusal", () => {
    it("is the expected refusal the gateway answers as a tool error, with its reason", async () => {
        const subject = await build()

        expect(subject.nativeRefusal("not_connected")).toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_connected" },
        })
    })
})
