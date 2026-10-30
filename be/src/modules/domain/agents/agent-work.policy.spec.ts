import { Test } from "@nestjs/testing"
import { noWorkLines as realNoWorkLines } from "./agent-work.policy"

const SUBJECT = Symbol("agent-work.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { noWorkLines: realNoWorkLines } }],
    }).compile()
    return moduleRef.get<{ noWorkLines: typeof realNoWorkLines }>(SUBJECT).noWorkLines
}

describe("agent work policy", () => {
    it("lists no work lines in the setup mode, which runs no dashboard", async () => {
        const noWorkLines = await buildSubject()

        await expect(noWorkLines()).resolves.toEqual([])
    })
})
