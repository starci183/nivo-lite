import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord, ProposeResult } from "@modules/domain/brain-facts"
import { BrainLessonsService } from "@modules/domain/brain-lessons"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { FactDecision, FactForm } from "./brain.contracts"
import { BrainLogEvent } from "./brain.log-events"
import { BrainService } from "./brain.service"
import { DocumentFactsService } from "./document-facts.service"

const WS = "ws-1"
const AT = "2026-10-12T10:00:00.000Z"
const factOf = builder<FactRecord>({
    id: "f1",
    subjectType: "business",
    subjectKey: "shop",
    subjectLabel: "Shop",
    attribute: "hours",
    attributeLabel: "Hours",
    value: "8 to 21",
    valueNumber: null,
    unit: null,
    scope: "public",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 100,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "Ada",
    proposedAt: AT,
    decidedBy: "Ada",
    decidedAt: AT,
    decisionNote: null,
})
const formOf = builder<FactForm>({
    subjectType: "business",
    subjectLabel: "Shop",
    attributeLabel: "Hours",
    value: "8 to 21",
    scope: "public",
    modules: [],
})
const memberOf = builder<WorkspaceMember>({
    userId: "u1",
    workspaceId: WS,
    role: "owner",
    staffId: null,
    displayName: "Ada",
    status: "active",
})
const lesson: LessonRecord = {
    id: "l1",
    module: null,
    title: "Confirm",
    body: "Confirm hours",
    appliesWhen: "Before replying",
    status: "active",
    origin: "manual",
    evidence: [],
    version: 1,
    proposedBy: "Ada",
    proposedAt: AT,
    decidedBy: "Ada",
    decidedAt: AT,
}

const build = async () => {
    const logger = mock<Logger>()
    const members = mock<WorkspaceMembersService>()
    const facts = mock<BrainFactsService>()
    const lessons = mock<BrainLessonsService>()
    const gaps = mock<KnowledgeGapsService>()
    const sources = mock<KnowledgeSourcesService>()
    const documentFacts = mock<DocumentFactsService>()
    members.require.mockResolvedValue(memberOf())
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
        ],
    }).compile()
    return { service: moduleRef.get(BrainService), logger, members, facts, lessons, gaps, sources, documentFacts }
}

describe("BrainService saveFact", () => {
    it("applies an owner's fact with dated manual evidence and answers its linked and matching questions", async () => {
        const { service, members, facts, gaps } = await build()
        const form = formOf({ note: "  Checked today  ", gapId: "g1", validFrom: AT, validTo: "2026-11-01" })

        await expect(service.saveFact("u1", WS, form)).resolves.toEqual({ fact: factOf(), outcome: "applied" })

        expect(members.require).toHaveBeenCalledWith("u1", WS, ["owner", "manager"])
        expect(facts.propose).toHaveBeenCalledWith(WS, {
            subjectType: "business",
            subjectLabel: "Shop",
            attributeLabel: "Hours",
            value: "8 to 21",
            scope: "public",
            modules: [],
            validFrom: AT,
            validTo: "2026-11-01",
            sourceKind: "owner",
            proposedBy: "Ada",
            autoApply: true,
            evidence: [
                {
                    kind: "manual",
                    ref: `manual:${Date.parse(AT)}`,
                    label: "Ada wrote this on the Second Brain page",
                    quote: "Checked today",
                    at: AT,
                },
            ],
        })
        expect(gaps.answer).toHaveBeenCalledWith(WS, "g1", "fact:f1")
        expect(gaps.resolve).toHaveBeenCalledWith(WS, {
            text: "Shop - Hours: 8 to 21",
            minimum: 0.6,
            module: null,
            by: "fact:f1",
        })
    })

    it.each([undefined, "   "])("records a manager's fact without an evidence quote for note %p", async (note) => {
        const { service, members, facts, gaps } = await build()
        members.require.mockResolvedValue(memberOf({ role: "manager", displayName: "Bo" }))

        await service.saveFact("u1", WS, formOf({ note }))

        expect(facts.propose).toHaveBeenCalledWith(WS, {
            subjectType: "business",
            subjectLabel: "Shop",
            attributeLabel: "Hours",
            value: "8 to 21",
            scope: "public",
            modules: [],
            validFrom: undefined,
            validTo: undefined,
            sourceKind: "manager",
            proposedBy: "Bo",
            autoApply: true,
            evidence: [
                {
                    kind: "manual",
                    ref: `manual:${Date.parse(AT)}`,
                    label: "Bo wrote this on the Second Brain page",
                    quote: undefined,
                    at: AT,
                },
            ],
        })
        expect(gaps.answer).not.toHaveBeenCalled()
    })
})
describe("BrainService saveFact", () => {
    const waiting: ReadonlyArray<ProposeResult> = [
        { fact: factOf(), outcome: "conflict" },
        { fact: factOf({ status: "scheduled" }), outcome: "applied" },
    ]
    it.each(waiting)("keeps a linked question open for result $outcome with status $fact.status", async (result) => {
        const { service, facts, gaps } = await build()
        facts.propose.mockResolvedValue(result)

        await expect(service.saveFact("u1", WS, formOf({ gapId: "g1" }))).resolves.toEqual(result)

        expect(gaps.answer).not.toHaveBeenCalled()
    })

    it("does not resolve other questions for an active internal fact", async () => {
        const { service, facts, gaps } = await build()
        const result: ProposeResult = { fact: factOf({ scope: "internal" }), outcome: "applied" }
        facts.propose.mockResolvedValue(result)

        await expect(service.saveFact("u1", WS, formOf({ scope: "internal", gapId: "g1" }))).resolves.toEqual(result)

        expect(gaps.answer).toHaveBeenCalledWith(WS, "g1", "fact:f1")
        expect(gaps.resolve).not.toHaveBeenCalled()
    })

    it("logs a matching failure and still returns the saved fact", async () => {
        const { service, logger, gaps } = await build()
        const cause = new Error("matching failed")
        gaps.resolve.mockRejectedValue(cause)

        await expect(service.saveFact("u1", WS, formOf())).resolves.toEqual({ fact: factOf(), outcome: "applied" })

        expect(logger.error).toHaveBeenCalledWith(BrainLogEvent.GapsFailed, cause, { factId: "f1" })
    })

    it("stops before proposing when membership is refused", async () => {
        const { service, members, facts, gaps } = await build()
        const cause = new Error("not a manager")
        members.require.mockRejectedValue(cause)

        await expect(service.saveFact("u1", WS, formOf())).rejects.toBe(cause)

        expect(facts.propose).not.toHaveBeenCalled()
        expect(gaps.answer).not.toHaveBeenCalled()
        expect(gaps.resolve).not.toHaveBeenCalled()
    })
})
describe("BrainService decideFact", () => {
    const decisions: ReadonlyArray<FactDecision> = [
        { workspaceId: WS, id: "f1", action: "apply" },
        { workspaceId: WS, id: "f1", action: "reject", note: "Incorrect" },
        { workspaceId: WS, id: "f1", action: "choose" },
        { workspaceId: WS, id: "f1", action: "split", situation: "Weekends" },
        { workspaceId: WS, id: "f1", action: "split" },
        { workspaceId: WS, id: "f1", action: "retire", note: "Ended" },
    ]
    it.each(decisions)("carries out $action and resolves questions covered by the returned fact", async (decision) => {
        const { service, members, facts, gaps } = await build()
        facts.apply.mockResolvedValue(factOf())
        facts.reject.mockResolvedValue(factOf())
        facts.choose.mockResolvedValue(factOf())
        facts.split.mockResolvedValue(factOf())
        facts.retire.mockResolvedValue(factOf())

        await expect(service.decideFact("u1", decision)).resolves.toEqual(factOf())

        expect(members.require).toHaveBeenCalledWith("u1", WS, ["owner", "manager"])
        expect(gaps.resolve).toHaveBeenCalledWith(WS, {
            text: "Shop - Hours: 8 to 21",
            minimum: 0.6,
            module: null,
            by: "fact:f1",
        })
        switch (decision.action) {
            case "apply":
                expect(facts.apply).toHaveBeenCalledWith(WS, "f1", "Ada", "")
                break
            case "reject":
                expect(facts.reject).toHaveBeenCalledWith(WS, "f1", "Ada", "Incorrect")
                break
            case "choose":
                expect(facts.choose).toHaveBeenCalledWith(WS, "f1", "Ada")
                break
            case "split":
                expect(facts.split).toHaveBeenCalledWith(WS, "f1", decision.situation ?? "", "Ada")
                break
            case "retire":
                expect(facts.retire).toHaveBeenCalledWith(WS, "f1", "Ada", "Ended")
                break
        }
    })
})
describe("BrainService keepCurrent", () => {
    it.each([undefined, "i1"])(
        "rejects waiting values under the caller's name for instance %p",
        async (installationId) => {
            const { service, facts } = await build()
            facts.keepCurrent.mockResolvedValue(3)

            await expect(
                service.keepCurrent("u1", {
                    workspaceId: WS,
                    subjectKey: "shop",
                    attribute: "hours",
                    installationId,
                }),
            ).resolves.toBe(3)

            expect(facts.keepCurrent).toHaveBeenCalledWith(WS, "shop", "hours", "Ada", installationId ?? null)
        },
    )
})
describe("BrainService lessons", () => {
    const verdicts: ReadonlyArray<"active" | "rejected"> = ["active", "rejected"]
    it.each([undefined, "chatbot"])("applies a manual lesson for module %p", async (module) => {
        const { service, lessons } = await build()

        await expect(
            service.saveLesson("u1", {
                workspaceId: WS,
                module,
                title: "Confirm",
                body: "Confirm hours",
                appliesWhen: "Before replying",
            }),
        ).resolves.toEqual(lesson)

        expect(lessons.propose).toHaveBeenCalledWith(WS, {
            module: module ?? null,
            title: "Confirm",
            body: "Confirm hours",
            appliesWhen: "Before replying",
            origin: "manual",
            proposedBy: "Ada",
            apply: true,
        })
    })

    it("retires an existing lesson", async () => {
        const { service, lessons } = await build()
        const retired = { ...lesson, status: "retired" }
        lessons.retire.mockResolvedValue({ ...lesson, status: "retired" })

        await expect(service.decideLesson("u1", { workspaceId: WS, id: "l1", action: "retired" })).resolves.toEqual(
            retired,
        )

        expect(lessons.retire).toHaveBeenCalledWith(WS, "l1", "Ada")
        expect(lessons.decide).not.toHaveBeenCalled()
    })

    it.each(verdicts)("records the %s verdict of a proposed lesson", async (action) => {
        const { service, lessons } = await build()
        lessons.decide.mockResolvedValue({ ...lesson, status: action })

        await expect(service.decideLesson("u1", { workspaceId: WS, id: "l1", action })).resolves.toEqual({
            ...lesson,
            status: action,
        })

        expect(lessons.decide).toHaveBeenCalledWith(WS, "l1", action, "Ada")
        expect(lessons.retire).not.toHaveBeenCalled()
    })
})
describe("BrainService", () => {
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

    it("lets a workspace member maintain and resolves each newly activated public fact in order", async () => {
        const { service, members, facts, gaps } = await build()
        facts.maintain.mockResolvedValue({ activated: [factOf(), factOf({ id: "f2", value: "9 to 20" })], expired: 2 })

        await expect(service.maintain("u1", WS)).resolves.toBeUndefined()

        expect(members.require).toHaveBeenCalledWith("u1", WS)
        expect(facts.maintain).toHaveBeenCalledWith(WS)
        expect(gaps.resolve.mock.calls).toEqual([
            [WS, { text: "Shop - Hours: 8 to 21", minimum: 0.6, module: null, by: "fact:f1" }],
            [WS, { text: "Shop - Hours: 9 to 20", minimum: 0.6, module: null, by: "fact:f2" }],
        ])
    })

    it("maintains a workspace with no new active facts", async () => {
        const { service, facts, gaps } = await build()
        facts.maintain.mockResolvedValue({ activated: [], expired: 0 })

        await expect(service.maintain("u1", WS)).resolves.toBeUndefined()

        expect(gaps.resolve).not.toHaveBeenCalled()
    })
})
