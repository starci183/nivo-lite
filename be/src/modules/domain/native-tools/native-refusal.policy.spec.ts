import { Test } from "@nestjs/testing"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import type { GatewayJson } from "@modules/domain/mcp-gateway"
import { argumentsOf, nativeRefusal, unknownTool } from "./native-refusal.policy"
import { PROVIDER_STATUS_SCHEMA } from "./provider-tools.schema"

const SUBJECT = Symbol("native-refusal.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { argumentsOf, nativeRefusal, unknownTool } }],
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

describe("unknownTool", () => {
    it("names the tool the connector does not have", async () => {
        const subject = await build()

        expect(subject.unknownTool("x.y")).toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
            params: { tool: "x.y" },
        })
    })
})

describe("argumentsOf", () => {
    it("returns the arguments as the validator reads them", async () => {
        const subject = await build()

        expect(subject.argumentsOf("t", PROVIDER_STATUS_SCHEMA, {})).toEqual({})
    })

    it("refuses arguments that do not fit, naming the tool", async () => {
        const subject = await build()
        const refusal = (args: GatewayJson): unknown => {
            try {
                return subject.argumentsOf("t", PROVIDER_STATUS_SCHEMA, args)
            } catch (cause) {
                return cause
            }
        }

        expect(refusal({ other: 1 })).toMatchObject({
            code: McpGatewayErrorCode.InvalidArguments,
            params: { tool: "t" },
        })
    })
})
