import { Test } from "@nestjs/testing"
import { toolSources } from "./card-sources.policy"
import { CARD_COPY } from "./messages/accounting-desk.messages"

const SUBJECT = Symbol("card-sources.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toolSources } }],
    }).compile()
    return moduleRef.get<typeof import("./card-sources.policy")>(SUBJECT)
}

describe("card-sources.policy", () => {
    it("cites each tool that answered by its name and leaves out a read nothing answered", async () => {
        const policy = await build()

        expect(
            policy.toolSources([
                { tool: "bank.transactions.list", label: CARD_COPY.sourceCredits },
                { tool: null, label: CARD_COPY.sourceReceivables },
            ]),
        ).toEqual([
            {
                layer: 1,
                kind: "mcp_tool",
                ref: "bank.transactions.list",
                label: CARD_COPY.toolSource(CARD_COPY.sourceCredits, "bank.transactions.list"),
            },
        ])
    })
})
