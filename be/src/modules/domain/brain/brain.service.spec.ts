import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { BrainFactsError, BrainFactsErrorCode, BrainFactsReadService, BrainFactsService } from "@modules/domain/brain-facts"
import type { ProposeResult } from "@modules/domain/brain-facts"
import { BrainLessonsService } from "@modules/domain/brain-lessons"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { FactDecision, FactForm } from "./brain.contracts"
import { BrainLogEvent } from "./brain.log-events"
import { BrainService } from "./brain.service"
import { DocumentFactsService } from "./document-facts.service"
import { SERVICE_AT, SERVICE_WS, serviceFactOf, serviceLesson, serviceMemberOf } from "@tests/fixtures/builders/brain-service.builder"

const WS = SERVICE_WS
const AT = SERVICE_AT
const factOf = serviceFactOf
const memberOf = serviceMemberOf
const lesson = serviceLesson
const formOf = builder<FactForm>({
    subjectType: "business",
    subjectLabel: "Shop",
    attributeLabel: "Hours",
    value: "8 to 21",
    scope: "public",
    modules: [],
})

const build = async () => {
    const logger = mock<Logger>()
    const members = mock<WorkspaceMembersService>()
    const facts = mock<BrainFactsService>()
    const lessons = mock<BrainLessonsService>()
    const gaps = mock<KnowledgeGapsService>()
    const sources = mock<KnowledgeSourcesService>()
    const documentFacts = mock<DocumentFactsService>()
    const reads = mock<BrainFactsReadService>()
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
        reads,
    }
}

describe("BrainService upkeep: the timed job that brings scheduled facts in force (BR1)", () => {
    /** The dev pair of D-P11-8: 35.000 d scheduled from 00:00 VN, nothing activated it until someone opened the page. */
    const scheduled = factOf({ id: "fee-35", value: "35.000 d", scope: "internal", status: "active", version: 2 })

    it("runs the page's maintain in every due workspace as the brain itself (no member check); no vector work of its own", async () => {
        const { service, reads, facts, members, logger, documentFacts } = await build()
        reads.dueWorkspaces.mockResolvedValue([WS, "ws-2"])
        facts.maintain
            .mockResolvedValueOnce({ activated: [scheduled], expired: 1 })
            .mockResolvedValueOnce({ activated: [], expired: 0 })
        documentFacts.resumeParked.mockResolvedValue(1)

        await expect(service.upkeep()).resolves.toEqual({
            workspaces: 2,
            activated: 1,
            expired: 1,
            failed: 0,
            readingsResumed: 1,
        })

        expect(reads.dueWorkspaces).toHaveBeenCalledWith(200)
        // Documents stored word-only for want of credits are looked at by the same tick (D-U-4).
        expect(documentFacts.resumeIndexing).toHaveBeenCalledTimes(1)
        expect(facts.maintain.mock.calls).toEqual([[WS], ["ws-2"]])
        expect(members.require).not.toHaveBeenCalled()
        // The fact that came in force gets its point from maintain's announcement (its sync job); the vector reconcile catches the rest.
        expect(logger.info).toHaveBeenCalledWith(BrainLogEvent.UpkeepDone, {
            workspaces: 2,
            activated: 1,
            expired: 1,
            failed: 0,
            readingsResumed: 1,
        })
    })

    it("does nothing when nothing is due, and one failing workspace never stops the others", async () => {
        const idle = await build()
        idle.reads.dueWorkspaces.mockResolvedValue([])
        idle.documentFacts.resumeParked.mockResolvedValue(0)
        await expect(idle.service.upkeep()).resolves.toEqual({
            workspaces: 0,
            activated: 0,
            expired: 0,
            failed: 0,
            readingsResumed: 0,
        })
        expect(idle.facts.maintain).not.toHaveBeenCalled()

        const { service, reads, facts, logger, documentFacts } = await build()
        documentFacts.resumeParked.mockResolvedValue(0)
        const cause = new Error("db")
        reads.dueWorkspaces.mockResolvedValue(["broken", WS])
        facts.maintain.mockRejectedValueOnce(cause).mockResolvedValueOnce({ activated: [], expired: 2 })
        await expect(service.upkeep()).resolves.toEqual({
            workspaces: 2,
            activated: 0,
            expired: 2,
            failed: 1,
            readingsResumed: 0,
        })
        expect(logger.error).toHaveBeenCalledWith(BrainLogEvent.UpkeepFailed, cause, { workspaceId: "broken" })
    })
})

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
            subject: "Shop",
            attribute: "Hours",
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
            // Only the founder puts a truth in force: a manager's write is a proposal for the founder.
            autoApply: false,
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

        // Turning a proposal down and splitting are a manager's too (a manager's split is only a proposal); every other activation and
        // retirement is the founder's alone.
        expect(members.require).toHaveBeenCalledWith(
            "u1",
            WS,
            decision.action === "reject" || decision.action === "split" ? ["owner", "manager"] : ["owner"],
        )
        expect(gaps.resolve).toHaveBeenCalledWith(WS, {
            subject: "Shop",
            attribute: "Hours",
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
                // The founder's split is the approval: in force at once.
                expect(facts.split).toHaveBeenCalledWith(WS, "f1", decision.situation ?? "", "Ada", true)
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

describe("BrainService founder-only activation", () => {
    it.each(["apply", "choose", "retire"] as const)(
        "refuses a manager who tries to %s: nothing goes in force",
        async (action) => {
            const { service, members, facts } = await build()
            const refused = new BrainFactsError({ code: BrainFactsErrorCode.NotProposed })
            members.require.mockImplementation((_user, _ws, roles) => {
                if (roles?.includes("manager") !== true) throw refused
                return Promise.resolve(memberOf({ role: "manager" }))
            })

            await expect(service.decideFact("u1", { workspaceId: WS, id: "f1", action })).rejects.toBe(refused)

            expect(facts.apply).not.toHaveBeenCalled()
            expect(facts.choose).not.toHaveBeenCalled()
            expect(facts.split).not.toHaveBeenCalled()
            expect(facts.retire).not.toHaveBeenCalled()
        },
    )

    it("a manager's split files the situational value as a PROPOSAL for the founder, never in force (BRAIN-LIMITS item 6)", async () => {
        const { service, members, facts } = await build()
        members.require.mockResolvedValue(memberOf({ role: "manager" }))
        facts.split.mockResolvedValue(factOf({ status: "proposed" }))

        await expect(
            service.decideFact("u1", { workspaceId: WS, id: "f1", action: "split", situation: "Cu\u1ed1i tu\u1ea7n" }),
        ).resolves.toMatchObject({ status: "proposed" })

        expect(members.require).toHaveBeenCalledWith("u1", WS, ["owner", "manager"])
        expect(facts.split).toHaveBeenCalledWith(WS, "f1", "Cu\u1ed1i tu\u1ea7n", "Ada", false)
        expect(facts.apply).not.toHaveBeenCalled()
    })

    it("lets the founder approve a change request; its point comes with the store's announcement (its sync job), nothing here", async () => {
        const { service, facts } = await build()
        facts.apply.mockResolvedValue(factOf({ status: "active", version: 2 }))

        await expect(service.decideFact("u1", { workspaceId: WS, id: "f1", action: "apply" })).resolves.toMatchObject({
            status: "active",
            version: 2,
        })

        expect(facts.apply).toHaveBeenCalledWith(WS, "f1", "Ada", "")
    })
})
