import { Test } from "@nestjs/testing"
import { factOf } from "@tests/fixtures/builders/brain-facts.builder"
import { builder, mock } from "@starci/jest-preset"
import { BrainDossiersReadService } from "@modules/domain/brain-dossiers"
import type { DossierEntry } from "@modules/domain/brain-dossiers"
import { BrainFactsReadService } from "@modules/domain/brain-facts"
import { KnowledgeChunksService } from "@modules/domain/knowledge-chunks"
import { DossierSourcesService } from "@modules/domain/knowledge-sources"
import type { DossierSource } from "@modules/domain/knowledge-sources"
import { ReviewInputsService, toReviewFact } from "./review-inputs.service"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-10-31T10:00:00.000Z"
const TODAY = "2026-10-31"

const dossierOf = builder<DossierEntry>({
    id: "d2",
    ref: "2",
    category: "LEGAL FILES",
    categoryOrder: 1,
    position: 2,
    name: "Dieu le cong ty",
    status: "partial",
    existing: "Charter",
    missing: null,
    drafts: null,
})

const sourceOf = builder<DossierSource>({
    id: "s2",
    title: "02. Dieu le",
    topic: "LEGAL FILES",
    tags: [],
    origin: null,
    kind: "file",
    status: "ready",
    chunkCount: 3,
    sizeBytes: 10,
    updatedAt: AT,
    createdAt: AT,
})

const D1 = dossierOf({ id: "d1", ref: "1", position: 1, name: "Giay chung nhan DKDN" })
const D2 = dossierOf()
const D8 = dossierOf({ id: "d8", ref: "8", category: "MEMBERS", position: 8, name: "So dang ky thanh vien" })
const D9 = dossierOf({ id: "d9", ref: "9", category: "MEMBERS", position: 9, name: "Danh sach thanh vien" })
const D58 = dossierOf({ id: "d58", ref: "58", category: "TEMPLATES", position: 58, name: "Mau quyet dinh" })

const S1 = sourceOf({ id: "s1", title: "01. Giay chung nhan" })
const S2 = sourceOf()
const S8 = sourceOf({ id: "s8", title: "Register", topic: "MEMBERS", tags: ["dossier:8"] })
const S9 = sourceOf({ id: "s9", title: "09. Danh sach", topic: "MEMBERS" })
const UNNUMBERED = sourceOf({ id: "sx", title: "No number" })
const UNFILED = sourceOf({ id: "sy", title: "02. Loose", topic: null })
const TEMPLATE = sourceOf({ id: "s58", title: "58. Mau quyet dinh", topic: "TEMPLATES" })

const signed = factOf({
    id: "f1",
    attribute: "ngay-ky",
    attributeLabel: "Ngay ky",
    value: "09.01.2026",
    valueNumber: null,
    evidence: [
        { kind: "document", ref: "s2", label: "Charter", sourceId: "s2", quote: "ky ngay 09.01.2026" },
        { kind: "document", ref: "s9", label: "List" },
        { kind: "manual", ref: "owner", label: "Owner" },
    ],
})
const stray = factOf({
    id: "f2",
    evidence: [
        { kind: "document", ref: "s404", label: "Gone" },
        { kind: "document", ref: "sy", label: "Loose" },
    ],
})
const listed = factOf({ id: "f3", evidence: [{ kind: "document", ref: "s9", label: "List" }] })
const undated = factOf({
    id: "f4",
    attribute: "ngay-ky",
    value: "unknown",
    validFrom: null,
    evidence: [{ kind: "document", ref: "s1", label: "Certificate" }],
})

const build = async () => {
    const dossiers = mock<BrainDossiersReadService>()
    const sources = mock<DossierSourcesService>()
    const chunks = mock<KnowledgeChunksService>()
    const facts = mock<BrainFactsReadService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ReviewInputsService,
            { provide: BrainDossiersReadService, useValue: dossiers },
            { provide: DossierSourcesService, useValue: sources },
            { provide: KnowledgeChunksService, useValue: chunks },
            { provide: BrainFactsReadService, useValue: facts },
        ],
    }).compile()
    chunks.passagesOfSources.mockResolvedValue([])
    facts.list.mockResolvedValue([])
    facts.ofSources.mockResolvedValue([])
    return { service: moduleRef.get(ReviewInputsService), dossiers, sources, chunks, facts }
}

describe("toReviewFact", () => {
    it("reads the dates, the documents it cites, its quotes and the time of its last decision", () => {
        expect(
            toReviewFact(
                factOf({
                    validFrom: "2026-08-17T00:00:00.000Z",
                    validTo: "2026-12-31T00:00:00.000Z",
                    decidedAt: "2026-10-30T00:00:00.000Z",
                    evidence: signed.evidence,
                }),
            ),
        ).toEqual({
            id: "f1",
            subjectKey: "shop",
            subject: "Shop",
            attribute: "hours",
            attributeLabel: "Hours",
            value: "8h",
            valueNumber: 8,
            unit: null,
            status: "proposed",
            validFrom: "2026-08-17",
            validTo: "2026-12-31",
            conflictWith: null,
            sourceIds: ["s2", "s9"],
            quotes: ["ky ngay 09.01.2026"],
            updatedAt: "2026-10-30T00:00:00.000Z",
        })
    })
})

describe("ReviewInputsService all", () => {
    it("answers the dossiers of the workspace", async () => {
        const { service, dossiers } = await build()
        dossiers.all.mockResolvedValue([D1])

        await expect(service.all(WS)).resolves.toEqual([D1])
        expect(dossiers.all).toHaveBeenCalledWith(WS)
    })
})

describe("ReviewInputsService collect", () => {
    it("reads a dossier, the dossiers the pack relates to it and those its facts also cite", async () => {
        const { service, dossiers, sources, chunks, facts } = await build()
        dossiers.all.mockResolvedValue([D1, D2, D8, D9, D58])
        sources.sourcesOfTopics.mockResolvedValue([S1, S2, S8, S9, UNNUMBERED, UNFILED, TEMPLATE])
        facts.ofSources.mockResolvedValueOnce([signed, stray, signed, undated]).mockResolvedValueOnce([signed, listed])
        chunks.passagesOfSources.mockResolvedValue([{ id: "p1", sourceId: "s2", order: 0, text: "Dieu le cong ty" }])
        facts.list.mockResolvedValue([factOf({ id: "fa", status: "active" })])

        const collected = await service.collect(WS, "d2", TODAY)

        expect(sources.sourcesOfTopics).toHaveBeenCalledWith(WS, ["LEGAL FILES", "MEMBERS", "TEMPLATES"], 2000)
        expect(facts.ofSources).toHaveBeenNthCalledWith(
            1,
            WS,
            ["s1", "s2", "s8"],
            ["active", "proposed", "scheduled"],
            2000,
        )
        expect(facts.ofSources).toHaveBeenNthCalledWith(2, WS, ["s9"], ["active", "proposed", "scheduled"], 2000)
        expect(chunks.passagesOfSources).toHaveBeenCalledWith(WS, ["s1", "s2", "s8", "s9"], 40)
        expect(facts.list).toHaveBeenCalledWith(WS, { statuses: ["active"], limit: 500 })
        expect(collected.targetIds).toEqual(["d2"])
        expect(collected.context.today).toBe(TODAY)
        expect(collected.context.activeFacts.map((fact) => fact.id)).toEqual(["fa"])
        expect(collected.context.dossiers.map((inputs) => inputs.dossier.id)).toEqual(["d1", "d2", "d8", "d9"])
        const [first, second, , fourth] = collected.context.dossiers
        expect(first?.documents).toEqual([
            {
                id: "s1",
                title: "01. Giay chung nhan",
                tags: [],
                origin: null,
                state: "actual",
                date: null,
                updatedAt: AT,
                chunkCount: 3,
                passages: [],
            },
        ])
        expect(first?.facts.map((fact) => fact.id)).toEqual(["f4"])
        expect(second?.dossier).toEqual({
            id: "d2",
            ref: "2",
            name: "Dieu le cong ty",
            category: "LEGAL FILES",
            position: 2,
            checklistStatus: "partial",
            existing: "Charter",
            missing: null,
            drafts: null,
        })
        expect(second?.entry?.ref).toBe("2")
        expect(second?.documents[0]).toMatchObject({
            id: "s2",
            date: "2026-01-09",
            passages: [{ id: "p1", order: 0, text: "Dieu le cong ty" }],
        })
        expect(second?.facts.map((fact) => fact.id)).toEqual(["f1"])
        expect(fourth?.facts.map((fact) => fact.id)).toEqual(["f1", "f3"])
    })
})

describe("ReviewInputsService collect of other passes", () => {
    it("reads every dossier for a workspace run, a template dossier's documents as templates", async () => {
        const { service, dossiers, sources, facts } = await build()
        dossiers.all.mockResolvedValue([D1, D58])
        sources.sourcesOfTopics.mockResolvedValue([S1, TEMPLATE])

        const collected = await service.collect(WS, null, TODAY)

        expect(facts.ofSources).toHaveBeenCalledTimes(1)
        expect(collected.targetIds).toEqual(["d1", "d58"])
        expect(collected.context.dossiers[1]?.documents[0]?.state).toBe("template")
        expect(collected.context.dossiers[1]?.entry?.requirement).toBe("template")
    })

    it("reads a dossier the pack does not know on its own", async () => {
        const { service, dossiers, sources } = await build()
        const other = dossierOf({ id: "dx", ref: "99", name: "Other" })
        dossiers.all.mockResolvedValue([D1, other])
        sources.sourcesOfTopics.mockResolvedValue([S1])

        const collected = await service.collect(WS, "dx", TODAY)

        expect(collected.context.dossiers.map((inputs) => [inputs.dossier.id, inputs.entry])).toEqual([["dx", null]])
        expect(collected.targetIds).toEqual(["dx"])
    })

    it("reads nothing for a dossier the workspace does not have", async () => {
        const { service, dossiers, sources, facts, chunks } = await build()
        dossiers.all.mockResolvedValue([D1])
        sources.sourcesOfTopics.mockResolvedValue([S1])

        await expect(service.collect(WS, "missing", TODAY)).resolves.toEqual({
            context: { today: TODAY, dossiers: [], activeFacts: [] },
            targetIds: [],
        })
        expect(facts.ofSources).not.toHaveBeenCalled()
        expect(chunks.passagesOfSources).not.toHaveBeenCalled()
    })
})
