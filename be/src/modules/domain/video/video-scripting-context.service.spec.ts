import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AuthorityService } from "@modules/domain/authority"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import { VideoScriptingContextService } from "./video-scripting-context.service"

const build = async () => {
    const facts = mock<BrainFactsService>()
    const authority = mock<AuthorityService>()
    const knowledge = mock<KnowledgeSearchService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoScriptingContextService,
            { provide: BrainFactsService, useValue: facts },
            { provide: AuthorityService, useValue: authority },
            { provide: KnowledgeSearchService, useValue: knowledge },
        ],
    }).compile()
    return { service: moduleRef.get(VideoScriptingContextService), facts, authority, knowledge }
}

describe("VideoScriptingContextService", () => {
    describe("forProject", () => {
        it("forProject has its first case written", async () => {
            const { service } = await build()
            expect(service.forProject).toBeInstanceOf(Function)
        })
    })
})
