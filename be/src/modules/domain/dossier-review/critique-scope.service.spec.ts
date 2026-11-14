import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { KnowledgeChunksService } from "@modules/domain/knowledge-chunks"
import type { TruthPassage } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CritiqueScopeService } from "./critique-scope.service"
import type { CriticPassage } from "./document-critic.contracts"

const WS = "11111111-1111-4111-8111-111111111111"
const SRC = "22222222-2222-4222-8222-222222222222"

const passage = (id: string): CriticPassage => ({ id, order: 0, text: `text of ${id}`, hash: `hash-${id}` })
const judged = (id: string, triage: TruthPassage["triage"]): TruthPassage => ({
    id,
    order: 0,
    text: `text of ${id}`,
    hash: `hash-${id}`,
    triage,
    triageVersion: triage === null ? null : 1,
    truthsVersion: null,
})

const build = async (visibility: string) => {
    const logger = mock<Logger>()
    const chunks = mock<KnowledgeChunksService>()
    chunks.truthPassagesOf.mockResolvedValue([judged("rule", "rule"), judged("data", "data"), judged("none", "none"), judged("unjudged", null)])
    const states = mock<KnowledgeSourcesReadService>()
    states.statesOf.mockResolvedValue([{ id: SRC, title: "Doc", visibility, status: "ready", contentHash: null }])
    const moduleRef = await Test.createTestingModule({
        providers: [
            CritiqueScopeService,
            { provide: LOGGER, useValue: logger },
            { provide: KnowledgeChunksService, useValue: chunks },
            { provide: KnowledgeSourcesReadService, useValue: states },
        ],
    }).compile()
    return { service: moduleRef.get(CritiqueScopeService), chunks, states, logger }
}

const PASSAGES = [passage("rule"), passage("data"), passage("none"), passage("unjudged")]

describe("CritiqueScopeService: the passages the critic's model does not have to read", () => {
    it("an internal document: the passages triage judged data or none; a rule passage and an unjudged one are read", async () => {
        const t = await build("internal")

        const exempt = await t.service.exemptOf(WS, SRC, PASSAGES)

        expect([...exempt]).toEqual(["hash-data", "hash-none"])
        expect(t.states.statesOf).toHaveBeenCalledWith(WS, [SRC])
    })

    it("a public document exempts nothing and reads no triage: customers are served every passage", async () => {
        const t = await build("public")

        await expect(t.service.exemptOf(WS, SRC, PASSAGES)).resolves.toEqual(new Set())
        expect(t.chunks.truthPassagesOf).not.toHaveBeenCalled()
    })

    it("a document that is gone, or a read that fails, exempts nothing: every passage is reviewed", async () => {
        const gone = await build("internal")
        gone.states.statesOf.mockResolvedValue([])
        await expect(gone.service.exemptOf(WS, SRC, PASSAGES)).resolves.toEqual(new Set())

        const failing = await build("internal")
        failing.chunks.truthPassagesOf.mockRejectedValue(new Error("db"))
        await expect(failing.service.exemptOf(WS, SRC, PASSAGES)).resolves.toEqual(new Set())
        expect(failing.logger.error).toHaveBeenCalled()
    })
})
