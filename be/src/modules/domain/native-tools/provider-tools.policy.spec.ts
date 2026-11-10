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
    it("gives a provider a status tool, read, auto and for internal use only", async () => {
        const subject = await build()

        const tools = subject.providerTools("Telegram")

        expect(tools.map((tool) => [tool.name, tool.scope, tool.defaultMode, tool.internalOnly])).toEqual([
            ["status.get", "read", "auto", true],
        ])
        expect(tools[0]?.description).toContain("Telegram")
    })
})
