import { Test } from "@nestjs/testing"
import { providerTools } from "./provider-tools.policy"

/** The members of the subject under test. */
interface Subject {
    readonly providerTools: typeof providerTools
}

const SUBJECT = Symbol("provider-tools.policy")

/** The policy function, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { providerTools } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("provider-tools.policy", () => {
    it("gives a channel a status and an events tool, both read, auto and for internal use only", async () => {
        const subject = await build()

        const tools = subject.providerTools("Telegram", true)

        expect(tools.map((tool) => [tool.name, tool.scope, tool.defaultMode, tool.internalOnly])).toEqual([
            ["status", "read", "auto", true],
            ["events", "read", "auto", true],
        ])
        expect(tools[0]?.description).toContain("Telegram")
        expect(tools[1]?.secretFields).toEqual(["customerMasked"])
        expect(tools[1]?.inputSchema).toMatchObject({ required: ["connectionId"], additionalProperties: false })
    })

    it("gives a provider that is no channel a status tool alone", async () => {
        const subject = await build()

        expect(subject.providerTools("SePay", false).map((tool) => tool.name)).toEqual(["status"])
    })
})
