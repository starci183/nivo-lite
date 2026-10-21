import { Test } from "@nestjs/testing"
import { CustomerTurnsError, CustomerTurnsErrorCode } from "./errors/customer-turns.error"
import {
    customerTurnsOptionsOf as realCustomerTurnsOptionsOf,
    toolsBaseUrlOf as realToolsBaseUrlOf,
} from "./tools-url.policy"

const SUBJECT = Symbol("tools-url.policy")

/** The policy as the testing module provides it. */
const build = async (): Promise<typeof import("./tools-url.policy")> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { toolsBaseUrlOf: realToolsBaseUrlOf, customerTurnsOptionsOf: realCustomerTurnsOptionsOf },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./tools-url.policy")>(SUBJECT)
}

describe("tools-url.policy", () => {
    it("puts the tool door under an https public api origin, whatever path the origin was written with", async () => {
        const { toolsBaseUrlOf } = await build()
        expect(toolsBaseUrlOf("https://api.nivo.vn")).toBe("https://api.nivo.vn/agent-tools")
        expect(toolsBaseUrlOf("https://api.nivo.vn/v1/?x=1")).toBe("https://api.nivo.vn/agent-tools")
    })

    it.each(["http://localhost:8787", "http://127.0.0.1:8787", "http://[::1]:8787", "http://api.localhost"])(
        "accepts plain http on the loopback host %s",
        async (origin) => {
            const { toolsBaseUrlOf } = await build()
            expect(toolsBaseUrlOf(origin)).toBe(`${new URL(origin).origin}/agent-tools`)
        },
    )

    it.each(["http://api.nivo.vn", "http://10.0.0.5:8787", "ftp://api.nivo.vn"])(
        "refuses the boot for the insecure origin %s",
        async (origin) => {
            const { toolsBaseUrlOf } = await build()
            expect(() => toolsBaseUrlOf(origin)).toThrow(
                new CustomerTurnsError({
                    code: CustomerTurnsErrorCode.ToolsUrlInvalid,
                    params: { url: new URL(origin).origin },
                }),
            )
        },
    )

    it.each([
        ["no origin", undefined],
        ["an unreadable origin", "api.nivo.vn"],
    ])("refuses the boot for %s", async (_case, origin) => {
        const { toolsBaseUrlOf } = await build()
        expect(() => toolsBaseUrlOf(origin)).toThrow(
            new CustomerTurnsError({ code: CustomerTurnsErrorCode.ToolsUrlInvalid, params: { url: origin ?? "" } }),
        )
    })

    it("derives the options of the customer turns from the parsed public api origin", async () => {
        const { customerTurnsOptionsOf } = await build()
        expect(customerTurnsOptionsOf("https://api.nivo.vn")).toEqual({
            toolsBaseUrl: "https://api.nivo.vn/agent-tools",
        })
    })
})
