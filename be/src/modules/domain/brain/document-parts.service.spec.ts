import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { BrainExtractionsService } from "@modules/domain/brain-extractions"
import type { DocumentTruthsView } from "@modules/domain/brain-extractions"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { DocumentPartsService } from "./document-parts.service"

const WS = "11111111-1111-4111-8111-111111111111"

const truthsOf = builder<DocumentTruthsView>({
    state: "done",
    stage: "settle",
    note: null,
    passagesTotal: 150,
    passagesTriaged: 150,
    passagesKept: 10,
    callsDone: 3,
    callsTotal: 3,
    truthsFound: 40,
    truthsInForce: 30,
    truthsAsked: 6,
    truthsWaiting: 4,
    callsSkipped: 0,
    linesRefused: 0,
})

const build = async (origins: Readonly<Record<string, string | null>>, later: Readonly<Record<string, ReadonlyArray<string>>>) => {
    const reads = mock<KnowledgeSourcesReadService>()
    reads.originOf.mockImplementation((_ws, id) => Promise.resolve(origins[id] ?? null))
    reads.ofOrigin.mockImplementation((_ws, origin) =>
        Promise.resolve((later[origin] ?? []).map((id) => ({ id, title: id, status: "ready", visibility: "internal", sizeBytes: 0, updatedAt: "" }))),
    )
    const extractions = mock<BrainExtractionsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentPartsService,
            { provide: KnowledgeSourcesReadService, useValue: reads },
            { provide: BrainExtractionsService, useValue: extractions },
        ],
    }).compile()
    return { service: moduleRef.get(DocumentPartsService), reads, extractions }
}

describe("DocumentPartsService: a document longer than one source, read as one document", () => {
    const world = () => build({ first: null, p2: "part:first", p3: "part:first", single: null }, { "part:first": ["p2", "p3"] })

    it("wholeOf: every part of the document, the first part first, from any of its parts; a document that fits one source is itself", async () => {
        const t = await world()

        await expect(t.service.wholeOf(WS, "first")).resolves.toEqual(["first", "p2", "p3"])
        await expect(t.service.wholeOf(WS, "p3")).resolves.toEqual(["first", "p2", "p3"])
        await expect(t.service.wholeOf(WS, "single")).resolves.toEqual(["single"])
        expect(t.reads.ofOrigin).toHaveBeenCalledWith(WS, "part:first", 500)
    })

    it("truthsOf: a file of several parts is ONE row (counts summed, the least advanced part's state); a one-part document costs no parts read; all in one read of the extractions", async () => {
        const t = await world()
        t.extractions.truthsOf.mockResolvedValue(
            new Map([
                ["first", truthsOf()],
                ["p2", truthsOf({ state: "awaiting_critique", note: "BRAIN_NOTE_AWAITING_CRITIQUE", truthsInForce: 0, truthsAsked: 0, truthsWaiting: 40 })],
                ["single", truthsOf({ truthsFound: 1, truthsInForce: 1, truthsAsked: 0, truthsWaiting: 0 })],
            ]),
        )

        const truths = await t.service.truthsOf(WS, [
            { id: "first", partCount: 3 },
            { id: "single", partCount: 1 },
            { id: "new", partCount: 1 },
        ])

        expect(t.extractions.truthsOf).toHaveBeenCalledTimes(1)
        expect(t.extractions.truthsOf).toHaveBeenCalledWith(WS, ["first", "p2", "p3", "single", "new"])
        expect(t.reads.originOf).toHaveBeenCalledTimes(1)
        // p3 has not started: the document is at the start of triage, with the counts of the parts that have.
        expect(truths.get("first")).toMatchObject({ state: "running", stage: "triage", truthsFound: 80, truthsInForce: 30, truthsAsked: 6, truthsWaiting: 44, passagesTotal: 300 })
        expect(truths.get("single")).toMatchObject({ state: "done", truthsInForce: 1 })
        expect(truths.has("new")).toBe(false)
    })
})
