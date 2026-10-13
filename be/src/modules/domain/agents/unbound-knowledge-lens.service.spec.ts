import { Test } from "@nestjs/testing"
import { UnboundKnowledgeLensService } from "./unbound-knowledge-lens.service"

const setup = async (): Promise<UnboundKnowledgeLensService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [UnboundKnowledgeLensService],
    }).compile()
    return moduleRef.get(UnboundKnowledgeLensService)
}

describe("UnboundKnowledgeLensService", () => {
    it("addresses the internal audience", async () => {
        const subject = await setup()

        expect(subject.audienceOf()).toBe("internal")
    })

    it("has no readable sources", async () => {
        const subject = await setup()

        await expect(subject.sourcesFor()).resolves.toEqual([])
    })

    it("has no memory", async () => {
        const subject = await setup()

        await expect(subject.memoryFor()).resolves.toBe("")
    })

    it("has no base rules", async () => {
        const subject = await setup()

        await expect(subject.baseRulesOf()).resolves.toEqual([])
    })

    it("counts no documents or facts for the internal audience", async () => {
        const subject = await setup()

        await expect(subject.countsFor()).resolves.toEqual({
            audience: "internal",
            documents: { public: 0, internal: 0 },
            facts: { public: 0, internal: 0, restricted: 0 },
        })
    })

    it("has no tracked open gaps", async () => {
        const subject = await setup()

        await expect(subject.openGapsOf()).resolves.toBeNull()
    })
})
