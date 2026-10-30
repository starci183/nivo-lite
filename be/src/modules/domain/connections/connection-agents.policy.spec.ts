import { Test } from "@nestjs/testing"
import { noAgentIds as realNoAgentIds } from "./connection-agents.policy"

const SUBJECT = Symbol("connection-agents.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { noAgentIds: realNoAgentIds } }],
    }).compile()
    return moduleRef.get<{ noAgentIds: typeof realNoAgentIds }>(SUBJECT).noAgentIds
}

describe("connection agents policy", () => {
    it("answers no agent for any connection when no agents are composed", async () => {
        const noAgentIds = await buildSubject()

        await expect(noAgentIds()).resolves.toEqual([])
    })
})
