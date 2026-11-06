import { Test } from "@nestjs/testing"
import { McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import type { GatewayJson } from "./mcp-gateway.contracts"
import type { ArgumentReader } from "./native-arguments.policy"
import { argumentsOf, invalidArguments, unknownTool } from "./native-arguments.policy"

const SUBJECT = Symbol("native-arguments.policy")

const NAME_ONLY: ArgumentReader<{ readonly name: string }> = {
    safeParse: (args) =>
        typeof args === "object" && args !== null && "name" in args && typeof args.name === "string"
            ? { success: true, data: { name: args.name } }
            : { success: false },
}

interface Subject {
    readonly argumentsOf: typeof argumentsOf
    readonly invalidArguments: typeof invalidArguments
    readonly unknownTool: typeof unknownTool
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { argumentsOf, invalidArguments, unknownTool } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("native arguments", () => {
    it("names the tool a connector does not have, and the tool whose arguments do not fit", async () => {
        const subject = await build()

        expect(subject.unknownTool("x.y")).toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
            params: { tool: "x.y" },
        })
        expect(subject.invalidArguments("turn")).toMatchObject({
            code: McpGatewayErrorCode.InvalidArguments,
            params: { tool: "turn" },
        })
    })

    it("returns the arguments as the validator reads them, and refuses ones that do not fit, naming the tool", async () => {
        const subject = await build()
        const read = (args: GatewayJson): unknown => {
            try {
                return subject.argumentsOf("t", NAME_ONLY, args)
            } catch (cause) {
                return cause
            }
        }

        expect(read({ name: "a" })).toEqual({ name: "a" })
        expect(read({ other: 1 })).toMatchObject({ code: McpGatewayErrorCode.InvalidArguments, params: { tool: "t" } })
    })
})
