import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import { BrainFactsReadService, BrainFactsService, type FactRecord } from "@modules/domain/brain-facts"
import { CLOCK } from "@modules/platform/clock"
import { DatabaseError, DatabaseErrorCode, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { CritiqueDecisionsService, DECIDED_NOTE } from "./critique-decisions.service"
import { DocumentCriticService } from "./document-critic.service"
import { DossierFindingEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"
const NOW = "2026-11-11T10:00:00.000Z"
const RAISED = new Date("2026-11-11T09:00:00.000Z")

const pointOf = (id: string, factIds: ReadonlyArray<string>): DossierFindingEntity =>
    Object.assign(new DossierFindingEntity(), { id, factIds: [...factIds], firstSeenAt: RAISED, sourceIds: ["doc-1"] })

const baseFact = builder<FactRecord>({
    id: "f-0",
    subjectType: "policy",
    subjectKey: "giao-hang",
    subjectLabel: "Giao hang",
    attribute: "phi",
    attributeLabel: "phi",
    value: "30.000",
    valueNumber: 30_000,
    unit: null,
    scope: "internal",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "document",
    trust: 75,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "Doc",
    proposedAt: "2026-11-11T03:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})

const factOf = (id: string, status: FactRecord["status"], decidedAt: string | null, decisionNote: string | null = null): FactRecord =>
    baseFact({ id, status, decidedAt, decisionNote })

const build = async (points: ReadonlyArray<DossierFindingEntity>, facts: ReadonlyArray<FactRecord>) => {
    const em = mockEntityManager({ find: [DossierFindingEntity, points], update: [DossierFindingEntity, { affected: 1 }] })
    const reads = mock<BrainFactsReadService>()
    reads.byIds.mockResolvedValue([...facts])
    const brainFacts = mock<BrainFactsService>()
    const critic = mock<DocumentCriticService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            CritiqueDecisionsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: BrainFactsService, useValue: brainFacts },
            { provide: BrainFactsReadService, useValue: reads },
            { provide: DocumentCriticService, useValue: critic },
        ],
    }).compile()
    return { service: moduleRef.get(CritiqueDecisionsService), em, critic, brainFacts, logger }
}

describe("CritiqueDecisionsService (D-BR-13): deciding a fact closes the critic point it settles", () => {
    it("registers with the facts store", async () => {
        const { service, brainFacts } = await build([], [])
        service.onModuleInit()
        expect(brainFacts.whenChanged).toHaveBeenCalledWith(service)
    })

    it("the founder chose the value a point asked about: the point is resolved and the document's gate set again", async () => {
        const { service, em, critic } = await build(
            [pointOf("p-conflict", ["f-30k", "f-20k"]), pointOf("p-other", ["f-30k"])],
            [factOf("f-30k", "active", "2026-11-11T09:30:00.000Z")],
        )

        await service.factsChanged(WS, ["f-30k"])

        expect(em.update).toHaveBeenCalledWith(
            DossierFindingEntity,
            expect.objectContaining({ workspaceId: WS }),
            expect.objectContaining({ status: "resolved", resolution: "manual", decisionNote: DECIDED_NOTE }),
        )
        const [, where] = em.update.mock.calls[0] ?? []
        expect(JSON.stringify(where)).toContain("p-conflict")
        expect(critic.regate).toHaveBeenCalledWith(WS, "doc-1")
        // The passages the point held are free again: the truths that waited on them are settled.
        expect(critic.changed).toHaveBeenCalledWith(WS, "doc-1")
    })

    it("a fact put in force BEFORE the point was raised (or not in force) settles nothing", async () => {
        const { service, em, critic } = await build(
            [pointOf("p1", ["f-old"]), pointOf("p2", ["f-rejected"])],
            [factOf("f-old", "active", "2026-11-11T08:00:00.000Z"), factOf("f-rejected", "rejected", "2026-11-11T09:30:00.000Z")],
        )

        await service.factsChanged(WS, ["f-old", "f-rejected"])

        expect(em.update).not.toHaveBeenCalled()
        expect(critic.regate).not.toHaveBeenCalled()
        expect(critic.changed).not.toHaveBeenCalled()
    })

    it("D-R-1: a truth the SETTLE of a document put in force by itself is no decision of the founder: the point that names it stays open", async () => {
        // One line stated two truths; the clean one was applied directly from another document while a point held the line.
        const { service, em, critic } = await build(
            [pointOf("p-line", ["f-clean", "f-doubted"])],
            [
                factOf("f-clean", "active", "2026-11-11T09:30:00.000Z", "direct:doc-2 - In force from the founder's own document"),
                factOf("f-doubted", "active", "2026-11-11T09:31:00.000Z", "updated:doc-2"),
            ],
        )

        await service.factsChanged(WS, ["f-clean", "f-doubted"])

        expect(em.update).not.toHaveBeenCalled()
        expect(critic.regate).not.toHaveBeenCalled()
    })

    it("never throws into the fact write", async () => {
        const { service, em, logger } = await build([], [])
        em.find.mockRejectedValue(new DatabaseError({ code: DatabaseErrorCode.ReturningRowRejected }))
        await expect(service.factsChanged(WS, ["f"])).resolves.toBeUndefined()
        expect(logger.error).toHaveBeenCalled()
    })
})

describe("CritiqueDecisionsService: a truth the founder's answer turned down leaves no question about it", () => {
    it("the founder's answer turned a truth down: the other open points that name it and no truth that still waits close; one that still names a waiting truth keeps asking", async () => {
        const { service, em, critic } = await build(
            [pointOf("p-twin", ["f-down"]), pointOf("p-against", ["f-in-force", "f-down"]), pointOf("p-line", ["f-down", "f-waits"])],
            [factOf("f-down", "rejected", "2026-11-11T09:30:00.000Z"), factOf("f-in-force", "active", "2026-11-11T08:00:00.000Z"), factOf("f-waits", "proposed", null)],
        )

        await service.turnedDown(WS, ["f-down"])

        const [, where] = em.update.mock.calls[0] ?? []
        expect(JSON.stringify(where)).toContain("p-twin")
        expect(JSON.stringify(where)).toContain("p-against")
        expect(JSON.stringify(where)).not.toContain("p-line")
        expect(critic.regate).toHaveBeenCalledWith(WS, "doc-1")
        expect(critic.changed).toHaveBeenCalledWith(WS, "doc-1")
    })

    it("no truth turned down: nothing is read or closed", async () => {
        const { service, em } = await build([pointOf("p", ["f"])], [])

        await service.turnedDown(WS, [])

        expect(em.find).not.toHaveBeenCalled()
        expect(em.update).not.toHaveBeenCalled()
    })
})
