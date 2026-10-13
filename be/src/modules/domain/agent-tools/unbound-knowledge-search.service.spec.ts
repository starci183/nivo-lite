import { Test } from "@nestjs/testing"
import { UnboundKnowledgeSearchService } from "./unbound-knowledge-search.service"

describe("UnboundKnowledgeSearchService", () => {
    it("returns empty passages and citations when knowledge search is unbound", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [UnboundKnowledgeSearchService],
        }).compile()
        const subject = moduleRef.get(UnboundKnowledgeSearchService)

        await expect(subject.search()).resolves.toEqual({ passages: "", citations: [] })
    })
})
