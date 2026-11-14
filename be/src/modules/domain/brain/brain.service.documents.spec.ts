import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { BrainFactsReadService, BrainFactsService } from "@modules/domain/brain-facts"
import { BrainLessonsService } from "@modules/domain/brain-lessons"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrainService } from "./brain.service"
import { DocumentFactsService } from "./document-facts.service"
import { FactVectorsSweepService } from "./fact-vectors-sweep.service"
import { SERVICE_AT, SERVICE_WS, serviceFactOf, serviceLesson, serviceMemberOf } from "@tests/fixtures/builders/brain-service.builder"

const WS = SERVICE_WS
const AT = SERVICE_AT
const factOf = serviceFactOf
const memberOf = serviceMemberOf
const lesson = serviceLesson

const build = async () => {
    const logger = mock<Logger>()
    const members = mock<WorkspaceMembersService>()
    const facts = mock<BrainFactsService>()
    const lessons = mock<BrainLessonsService>()
    const gaps = mock<KnowledgeGapsService>()
    const sources = mock<KnowledgeSourcesService>()
    const documentFacts = mock<DocumentFactsService>()
    const vectors = mock<FactVectorsSweepService>()
    const reads = mock<BrainFactsReadService>()
    members.require.mockResolvedValue(memberOf())
    vectors.sweep.mockResolvedValue({ workspaces: 0, embedded: 0, copied: 0, more: 0 })
    facts.propose.mockResolvedValue({ fact: factOf(), outcome: "applied" })
    lessons.propose.mockResolvedValue(lesson)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainService,
            { provide: LOGGER, useValue: logger },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: BrainFactsService, useValue: facts },
            { provide: BrainLessonsService, useValue: lessons },
            { provide: KnowledgeGapsService, useValue: gaps },
            { provide: KnowledgeSourcesService, useValue: sources },
            { provide: DocumentFactsService, useValue: documentFacts },
            { provide: FactVectorsSweepService, useValue: vectors },
            { provide: BrainFactsReadService, useValue: reads },
        ],
    }).compile()
    return {
        service: moduleRef.get(BrainService),
        logger,
        members,
        facts,
        lessons,
        gaps,
        sources,
        documentFacts,
        vectors,
        reads,
    }
}

describe("BrainService: gaps and sources", () => {
    it("dismisses a customer question under the manager's name", async () => {
        const { service, members, gaps } = await build()

        await expect(service.dismissGap("u1", WS, "g1")).resolves.toBeUndefined()

        expect(members.require).toHaveBeenCalledWith("u1", WS, ["owner", "manager"])
        expect(gaps.dismiss).toHaveBeenCalledWith(WS, "g1", "Ada")
    })

    it("withdraws a deleted document's facts using its returned title", async () => {
        const { service, sources, documentFacts } = await build()
        sources.removeSource.mockResolvedValue({ title: "Hours", parts: [] })

        await expect(service.removeSource("u1", WS, "s1")).resolves.toBeUndefined()

        expect(sources.removeSource).toHaveBeenCalledWith("u1", WS, "s1")
        expect(documentFacts.withdraw).toHaveBeenCalledWith(WS, "s1", "Hours")
    })

    it("takes back what the later parts of a deleted long document contributed as well", async () => {
        const { service, sources, documentFacts } = await build()
        sources.removeSource.mockResolvedValue({
            title: "Plan (1/3)",
            parts: [
                { id: "p2", title: "Plan (2/3)" },
                { id: "p3", title: "Plan (3/3)" },
            ],
        })

        await service.removeSource("u1", WS, "s1")

        expect(documentFacts.withdraw.mock.calls).toEqual([
            [WS, "s1", "Plan (1/3)"],
            [WS, "p2", "Plan (2/3)"],
            [WS, "p3", "Plan (3/3)"],
        ])
    })

    it("does not withdraw a source when deleting it fails", async () => {
        const { service, sources, documentFacts } = await build()
        const cause = new Error("source absent")
        sources.removeSource.mockRejectedValue(cause)

        await expect(service.removeSource("u1", WS, "s1")).rejects.toBe(cause)

        expect(documentFacts.withdraw).not.toHaveBeenCalled()
    })
})

describe("BrainService: sources and facts of a document", () => {
    it("lets a workspace member maintain and resolves each newly activated public fact in order", async () => {
        const { service, members, facts, gaps } = await build()
        facts.maintain.mockResolvedValue({ activated: [factOf(), factOf({ id: "f2", value: "9 to 20" })], expired: 2 })
        facts.repairAudience.mockResolvedValue([])

        await expect(service.maintain("u1", WS)).resolves.toBeUndefined()

        expect(members.require).toHaveBeenCalledWith("u1", WS)
        expect(facts.maintain).toHaveBeenCalledWith(WS)
        expect(gaps.resolve.mock.calls).toEqual([
            [WS, { subject: "Shop", attribute: "Hours", module: null, by: "fact:f1" }],
            [WS, { subject: "Shop", attribute: "Hours", module: null, by: "fact:f2" }],
        ])
    })

    it("maintains a workspace with no new active facts", async () => {
        const { service, facts, gaps } = await build()
        facts.maintain.mockResolvedValue({ activated: [], expired: 0 })
        facts.repairAudience.mockResolvedValue([])

        await expect(service.maintain("u1", WS)).resolves.toBeUndefined()

        expect(gaps.resolve).not.toHaveBeenCalled()
    })

    it("gives back to customers the truths a public document states (D-BR-1 repair), asking which documents are public", async () => {
        const { service, facts, sources, gaps } = await build()
        facts.maintain.mockResolvedValue({ activated: [], expired: 0 })
        sources.sourceOf.mockImplementation((_ws, id) =>
            Promise.resolve(mock<KnownSource>({ visibility: id === "src-p01" ? "public" : "internal" })),
        )
        const widened = factOf({ id: "v2", status: "active", scope: "public" })
        facts.repairAudience.mockImplementation(async (_ws, publicOf) => {
            expect([...(await publicOf(["src-p01", "src-r1", "gone"]))]).toEqual(["src-p01"])
            return [widened]
        })

        await service.maintain("u1", WS)

        expect(facts.repairAudience).toHaveBeenCalledWith(WS, expect.any(Function))
        expect(gaps.resolve).toHaveBeenCalledWith(WS, expect.objectContaining({ by: "fact:v2" }))
    })
})

/** A document as the sources service answers it. */
type KnownSource = NonNullable<Awaited<ReturnType<KnowledgeSourcesService["sourceOf"]>>>
