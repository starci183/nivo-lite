import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import { KnowledgeSourcesReadService, type SourceBrief } from "@modules/domain/knowledge-sources"
import { KnowledgeChunksService } from "@modules/domain/knowledge-chunks"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DocumentCriticService } from "./document-critic.service"
import { DocumentCritiqueReadService } from "./document-critique-read.service"
import { DossierFindingEntity, SourceCritiqueEntity } from "./persistence/entities"

const WS = "ws-1"
const SRC = "src-1"
const NOW = "2026-11-12T08:00:00.000Z"

/** Any value but none, typed `unknown` so it flows into any matcher slot. */
const anyValue = (): unknown => expect.anything()

const sourceOf = builder<SourceBrief>({
    id: SRC,
    title: "Menu",
    topic: null,
    kind: "document",
})

/** The reads of the service built over a mocked entity manager and the three collaborators it reads through. */
const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const critic = mock<DocumentCriticService>()
    critic.pointsOf.mockResolvedValue([])
    const chunks = mock<KnowledgeChunksService>()
    chunks.placesOf.mockResolvedValue(new Map())
    chunks.passagesOf.mockResolvedValue([])
    const sources = mock<KnowledgeSourcesReadService>()
    sources.briefsOf.mockResolvedValue([sourceOf()])
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentCritiqueReadService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: DocumentCriticService, useValue: critic },
            { provide: KnowledgeChunksService, useValue: chunks },
            { provide: KnowledgeSourcesReadService, useValue: sources },
        ],
    }).compile()
    return { service: moduleRef.get(DocumentCritiqueReadService), critic, chunks, sources }
}

const SERVING_SQL =
    "SELECT count(*)::int AS total, count(*) FILTER (WHERE customer_ready)::int AS ready FROM public.knowledge_chunks WHERE workspace_id = $1 AND source_id = $2"

describe("DocumentCritiqueReadService: the review of a document", () => {
    it("reads a document with no critique as waiting, with nothing read yet", async () => {
        const { service } = await build(mockEntityManager({ findOne: [SourceCritiqueEntity, null] }))

        await expect(service.reviewOfSource(WS, SRC)).resolves.toEqual({
            state: "waiting",
            reason: null,
            attempts: 0,
            finishedAt: null,
            released: false,
            releasedAt: null,
            waitingPassages: 0,
        })
    })

    it("reads a finished critique with its attempts, its end and its waiting passages", async () => {
        const row = Object.assign(new SourceCritiqueEntity(), {
            state: "not_done",
            reason: "credits",
            attempts: 3,
            finishedAt: new Date(NOW),
            releasedAt: null,
            waitingPassages: 4,
        })
        const { service } = await build(mockEntityManager({ findOne: [SourceCritiqueEntity, row] }))

        await expect(service.reviewOfSource(WS, SRC)).resolves.toEqual({
            state: "not_done",
            reason: "credits",
            attempts: 3,
            finishedAt: NOW,
            released: false,
            releasedAt: null,
            waitingPassages: 4,
        })
    })
})

describe("DocumentCritiqueReadService: the page of one document and the list", () => {
    it("answers nothing for a document that is not the workspace's", async () => {
        const { service, sources } = await build(mockEntityManager())
        sources.briefsOf.mockResolvedValue([])

        await expect(service.view(WS, SRC, ["open"])).resolves.toBeNull()
    })

    it("counts no points and serves every passage of a document whose passages are all customer-ready", async () => {
        const em = mockEntityManager({
            findOne: [SourceCritiqueEntity, null],
            query: [SERVING_SQL, [{ total: 2, ready: 2 }]],
        })
        const { service } = await build(em)

        const view = await service.view(WS, SRC, ["open"])

        expect(view).toMatchObject({
            sourceId: SRC,
            title: "Menu",
            counts: { open: 0, high: 0, answered: 0, skipped: 0, gone: 0 },
            points: [],
            serving: { state: "served", withheldPassages: 0, totalPassages: 2, reasons: [] },
        })
    })

    it("lists nothing when no document of the workspace was critiqued", async () => {
        const { service } = await build(mockEntityManager({ find: [SourceCritiqueEntity, []] }))

        await expect(service.sourcesOf(WS)).resolves.toEqual([])
    })

    it("finds no critic point for a finding that is not one of the workspace", async () => {
        const { service } = await build(mockEntityManager({ findOne: [DossierFindingEntity, null] }))

        await expect(service.point(WS, "missing")).resolves.toBeNull()
    })
})

describe("DocumentCritiqueReadService: skipping a point and releasing a document", () => {
    it("dismisses a point with the reason, then sets the customer gate and the truths of its document again", async () => {
        const finding = Object.assign(new DossierFindingEntity(), {
            id: "p1",
            ruleKey: "shop.vague",
            evidenceHash: "e1",
            params: { sourceId: SRC },
        })
        const em = mockEntityManager({ findOneOrFail: [DossierFindingEntity, finding], update: [DossierFindingEntity, {}] })
        const { service, critic } = await build(em)

        await service.skip(WS, "p1", "u1", "not a problem")

        expect(em.update).toHaveBeenCalledWith(
            DossierFindingEntity,
            { workspaceId: WS, id: "p1", status: anyValue() },
            {
                status: "dismissed",
                dismissReason: "not a problem",
                dismissedEvidenceHash: "e1",
                decidedBy: "u1",
                decidedAt: new Date(NOW),
            },
        )
        expect(critic.regate).toHaveBeenCalledWith(WS, SRC)
        expect(critic.changed).toHaveBeenCalledWith(WS, SRC)
    })

    it("releases nothing for a document with no critique", async () => {
        const em = mockEntityManager({ update: [SourceCritiqueEntity, { affected: 0 }] })
        const { service, critic } = await build(em)

        await expect(service.release(WS, SRC, "u1")).resolves.toBeNull()
        expect(critic.regate).not.toHaveBeenCalled()
    })

    it("lets customers read what a critique read, sets the gate again and answers how many passages are served", async () => {
        const em = mockEntityManager({
            update: [SourceCritiqueEntity, { affected: 1 }],
            query: [SERVING_SQL, [{ total: 2, ready: 2 }]],
        })
        const { service, critic } = await build(em)

        await expect(service.release(WS, SRC, "u1")).resolves.toMatchObject({ state: "served", totalPassages: 2 })

        expect(em.update).toHaveBeenCalledWith(
            SourceCritiqueEntity,
            { workspaceId: WS, sourceId: SRC },
            { releasedBy: "u1", releasedAt: new Date(NOW) },
        )
        expect(critic.regate).toHaveBeenCalledWith(WS, SRC)
    })
})
