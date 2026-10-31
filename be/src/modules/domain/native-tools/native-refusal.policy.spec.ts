import { z } from "zod"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { argumentsOf, nativeRefusal, unknownTool } from "./native-refusal.policy"

describe("nativeRefusal", () => {
    it("is the expected refusal the gateway answers as a tool error, with its reason", () => {
        expect(nativeRefusal("not_connected")).toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_connected" },
        })
    })
})

describe("unknownTool", () => {
    it("names the tool the connector does not have", () => {
        expect(unknownTool("x.y")).toMatchObject({ code: McpGatewayErrorCode.UnknownTool, params: { tool: "x.y" } })
    })
})

describe("argumentsOf", () => {
    const schema = z.object({ limit: z.number().int().default(5) }).strict()

    it("returns the arguments as the validator reads them, with its defaults", () => {
        expect(argumentsOf("t", schema, {})).toEqual({ limit: 5 })
        expect(argumentsOf("t", schema, { limit: 2 })).toEqual({ limit: 2 })
    })

    it("refuses arguments that do not fit, naming the tool", () => {
        expect(() => argumentsOf("t", schema, { limit: "2" })).toThrow(
            expect.objectContaining({ code: McpGatewayErrorCode.InvalidArguments, params: { tool: "t" } }),
        )
        expect(() => argumentsOf("t", schema, { other: 1 })).toThrow(
            expect.objectContaining({ code: McpGatewayErrorCode.InvalidArguments }),
        )
    })
})
