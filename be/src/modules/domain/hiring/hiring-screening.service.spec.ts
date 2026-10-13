import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ApprovalGate, TextGenerator } from "@modules/domain/module-ops"
import type { PerformContext } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { HiringErrorCode } from "./errors/hiring.error"
import type { CandidateRecord, JobRecord } from "./hiring.contracts"
import { HiringDataService } from "./hiring-data.service"
import { HiringScreeningService } from "./hiring-screening.service"
import { HiringTextService } from "./hiring-text.service"
import { HiringLogEvent } from "./hiring.log-events"
import { SET_SCREENED } from "./persistence/hiring.sql"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const candidateOf = builder<CandidateRecord>({
    id: "candidate-1",
    workspaceId: "ws-1",
    jobId: "job-1",
    name: "Alex",
    phone: "0901234567",
    email: "alex@example.com",
    source: "page",
    conversationId: null,
    cvPath: null,
    cvName: null,
    cvMime: null,
    answers: [],
    availability: "",
    stage: "applied",
    staffId: null,
})

const jobOf = builder<JobRecord>({
    id: "job-1",
    workspaceId: "ws-1",
    slug: "barista",
    title: "Barista",
    position: "Barista",
    employmentType: "full_time",
    schedule: "Morning",
    payMinVnd: null,
    payMaxVnd: null,
    payUnit: "month",
    location: "Cafe",
    headcount: 1,
    description: "Prepare drinks",
    requirements: {
        skills: [],
        experienceYears: null,
        experienceNote: "",
        availability: [],
        mustHave: [],
        niceToHave: [],
    },
    questions: [],
    status: "open",
    channels: ["page"],
    closesAt: null,
})

const contextOf = (fields: PerformContext["fields"]): PerformContext => ({
    workspaceId: "ws-1",
    workItemId: "work-1",
    actor: "Manager",
    draft: null,
    fields: { candidate_id: "candidate-1", ...fields },
})

const screenedQuery = (score: number, label: string, reasons: string, detail: string | null) => [
    SET_SCREENED,
    [
        "ws-1",
        "candidate-1",
        score,
        label,
        reasons,
        detail,
        "Manager",
        text("hiring.event.screened", { score, label: text(`hiring.scoreLabel.${label}`) }),
    ],
]

const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const words = mock<HiringTextService>()
    words.text.mockImplementation((key, params) => catalog.get(key, params ?? {}, "vi"))
    words.textOf.mockImplementation((key, params) => catalog.get(key, { ...params }, "vi"))
    const logger = mock<Logger>()
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "manager",
        staffId: null,
        displayName: "Manager",
        status: "active",
    })
    const data = mock<HiringDataService>()
    data.candidate.mockResolvedValue(candidateOf())
    data.job.mockResolvedValue(jobOf())
    data.askAttempts.mockResolvedValue(2)
    const generator = mock<TextGenerator>()
    generator.generate.mockResolvedValue({ ok: false, output: "" })
    const gate = mock<ApprovalGate>()
    gate.request.mockResolvedValue({ status: "waiting_decision", workItemId: "work-1" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            HiringScreeningService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: LOGGER, useValue: logger },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ApprovalGate, useValue: gate },
            { provide: TextGenerator, useValue: generator },
            { provide: HiringDataService, useValue: data },
            { provide: HiringTextService, useValue: words },
        ],
    }).compile()
    return { service: moduleRef.get(HiringScreeningService), catalog, words, logger, members, data, generator, gate }
}

describe("HiringScreeningService", () => {
    describe("requestScreening", () => {
        it("leaves a missing candidate waiting without reading a job", async () => {
            const { service, data, generator, gate } = await build()
            data.candidate.mockResolvedValue(undefined)

            await expect(service.requestScreening("ws-1", "missing", false)).resolves.toBeNull()

            expect(data.candidate.mock.calls).toEqual([["ws-1", "missing"]])
            expect(data.job).not.toHaveBeenCalled()
            expect(generator.generate).not.toHaveBeenCalled()
            expect(gate.request).not.toHaveBeenCalled()
        })

        it("leaves a candidate waiting when the job has disappeared", async () => {
            const { service, data, gate } = await build()
            data.job.mockResolvedValue(undefined)

            await expect(service.requestScreening("ws-1", "candidate-1", false)).resolves.toBeNull()

            expect(data.job.mock.calls).toEqual([["ws-1", "job-1"]])
            expect(gate.request).not.toHaveBeenCalled()
        })

        it("asks with fallback text and the original dedupe key when the model fails", async () => {
            const { service, generator, gate, data } = await build()

            await expect(service.requestScreening("ws-1", "candidate-1", false)).resolves.toEqual({
                status: "waiting_decision",
                workItemId: "work-1",
            })

            expect(generator.generate.mock.calls).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        purpose: "hiring_screen",
                        module: "hiring",
                        system: text("hiring.screen.system"),
                        user: text("hiring.screen.user", {
                            criteria: text("hiring.criteria.position", {
                                title: "Barista",
                                where: `${text("hiring.employment.full_time")}, Morning, Cafe`,
                            }),
                            score: 0,
                            lines: text("hiring.screen.noCriteria"),
                            answers: text("hiring.screen.noAnswers"),
                            availability: text("hiring.screen.noAvailability"),
                        }),
                        timeoutMs: 75000,
                    },
                ],
            ])
            expect(gate.request.mock.calls).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        actor: text("hiring.actor"),
                        action: "screen_candidate",
                        subjectType: "candidate",
                        subjectId: "candidate-1",
                        dedupeKey: "screen_candidate:candidate-1",
                        summary: text("hiring.screen.summary", {
                            name: "Alex",
                            score: 0,
                            label: text("hiring.scoreLabel.consider"),
                            title: "Barista",
                        }),
                        draft: text("hiring.screen.noSummary"),
                        fields: {
                            candidate_id: "candidate-1",
                            job_id: "job-1",
                            score: 0,
                            label: "consider",
                            reasons: "[]",
                            ai_summary: null,
                            questions: "[]",
                        },
                    },
                ],
            ])
            expect(data.askAttempts).not.toHaveBeenCalled()
        })

        it("scrubs volunteered traits and model output and retains three fair questions on a new attempt", async () => {
            const { service, data, generator, gate } = await build()
            data.candidate.mockResolvedValue(
                candidateOf({
                    answers: [{ questionId: "skills", question: "Skills", answer: "coffee. nu." }],
                    availability: "weekday. nu.",
                }),
            )
            data.job.mockResolvedValue(
                jobOf({
                    requirements: {
                        skills: ["coffee"],
                        experienceYears: null,
                        experienceNote: "",
                        availability: [],
                        mustHave: [],
                        niceToHave: [],
                    },
                }),
            )
            generator.generate.mockResolvedValue({
                ok: true,
                output: JSON.stringify({
                    summary: "Useful worker. nu.",
                    interview_questions: [
                        "How do you brew?",
                        "nu",
                        "When can you start?",
                        "What is your setup?",
                        "Extra question?",
                        9,
                    ],
                }),
            })
            const criterion = text("hiring.screen.skill", { skill: "coffee" })
            const note = text("hiring.screen.skillMet")
            const questions = ["How do you brew?", "When can you start?", "What is your setup?"]

            await expect(service.requestScreening("ws-1", "candidate-1", true)).resolves.toEqual({
                status: "waiting_decision",
                workItemId: "work-1",
            })

            expect(generator.generate.mock.calls).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        purpose: "hiring_screen",
                        module: "hiring",
                        system: text("hiring.screen.system"),
                        user: text("hiring.screen.user", {
                            criteria: [
                                text("hiring.criteria.position", {
                                    title: "Barista",
                                    where: `${text("hiring.employment.full_time")}, Morning, Cafe`,
                                }),
                                text("hiring.criteria.skills", { list: "coffee" }),
                            ].join("\n"),
                            score: 100,
                            lines: text("hiring.screen.line", {
                                status: text("hiring.reasonStatus.met"),
                                criterion,
                                note,
                            }),
                            answers: text("hiring.screen.answer", { question: "Skills", answer: "coffee." }),
                            availability: "weekday.",
                        }),
                        timeoutMs: 75000,
                    },
                ],
            ])
            expect(data.askAttempts.mock.calls).toEqual([["ws-1", "screen_candidate", "screen_candidate:candidate-1:"]])
            expect(gate.request.mock.calls).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        actor: text("hiring.actor"),
                        action: "screen_candidate",
                        subjectType: "candidate",
                        subjectId: "candidate-1",
                        dedupeKey: "screen_candidate:candidate-1:3",
                        summary: text("hiring.screen.summary", {
                            name: "Alex",
                            score: 100,
                            label: text("hiring.scoreLabel.fit"),
                            title: "Barista",
                        }),
                        draft: `Useful worker.\n\n${text("hiring.screen.questions", {
                            list: "- How do you brew?\n- When can you start?\n- What is your setup?",
                        })}`,
                        fields: {
                            candidate_id: "candidate-1",
                            job_id: "job-1",
                            score: 100,
                            label: "fit",
                            reasons: JSON.stringify([{ criterion, status: "met", note }]),
                            ai_summary: "Useful worker.",
                            questions: JSON.stringify(questions),
                        },
                    },
                ],
            ])
        })

        it("caps a model summary at seven hundred characters", async () => {
            const { service, generator, gate } = await build()
            generator.generate.mockResolvedValue({ ok: true, output: JSON.stringify({ summary: "a".repeat(701) }) })

            await service.requestScreening("ws-1", "candidate-1", false)

            expect(gate.request.mock.calls.map(([request]) => [request.draft, request.fields.ai_summary])).toEqual([
                ["a".repeat(700), "a".repeat(700)],
            ])
        })

        it("falls back when a successful model reply contains no JSON object", async () => {
            const { service, generator, gate } = await build()
            generator.generate.mockResolvedValue({ ok: true, output: "unstructured" })

            await service.requestScreening("ws-1", "candidate-1", false)

            expect(gate.request.mock.calls.map(([request]) => [request.draft, request.fields.ai_summary])).toEqual([
                [text("hiring.screen.noSummary"), null],
            ])
        })

        it("logs a gate failure and leaves the candidate waiting", async () => {
            const { service, gate, logger } = await build()
            const cause = new Error("Gate unavailable")
            gate.request.mockRejectedValue(cause)

            await expect(service.requestScreening("ws-1", "candidate-1", false)).resolves.toBeNull()

            expect(logger.error.mock.calls).toEqual([[HiringLogEvent.AskFailed, { candidateId: "candidate-1", cause }]])
        })
    })

    describe("rescreen", () => {
        it("requires a manager and refuses a missing candidate", async () => {
            const { service, data, members, gate } = await build()
            data.candidate.mockResolvedValue(undefined)

            await expect(service.rescreen("user-1", "ws-1", { id: "missing" })).rejects.toMatchObject({
                code: HiringErrorCode.CandidateNotFound,
                params: {},
            })

            expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
            expect(gate.request).not.toHaveBeenCalled()
        })

        it("reports the gate outcome for a new screening attempt", async () => {
            const { service, data } = await build()

            await expect(service.rescreen("user-1", "ws-1", { id: "candidate-1" })).resolves.toEqual({
                status: "waiting_decision",
                summary: text("hiring.screen.asked"),
                error: null,
            })

            expect(data.askAttempts.mock.calls).toEqual([["ws-1", "screen_candidate", "screen_candidate:candidate-1:"]])
        })

        it("reports an unavailable request as a failed rescreen", async () => {
            const { service, data } = await build()
            data.job.mockResolvedValue(undefined)

            await expect(service.rescreen("user-1", "ws-1", { id: "candidate-1" })).resolves.toEqual({
                status: "failed",
                summary: text("hiring.screen.notAsked"),
                error: text("hiring.screen.notAsked"),
            })
        })
    })

    describe("perform", () => {
        it("refuses a candidate who no longer exists", async () => {
            const em = mockEntityManager()
            const { service, data } = await build(em)
            data.candidate.mockResolvedValue(undefined)

            await expect(service.perform(contextOf({}))).rejects.toMatchObject({
                code: HiringErrorCode.CandidateNotFound,
                params: {},
            })

            expect(em.query).not.toHaveBeenCalled()
        })

        it("stores only complete reasons and string questions and joins the summary with questions", async () => {
            const em = mockEntityManager({ query: [SET_SCREENED, [{ value: true }]] })
            const { service } = await build(em)
            const reasons = [
                { criterion: "Skills", status: "met", note: "Confirmed" },
                { criterion: "Experience", status: "unmet", note: "Insufficient" },
                { criterion: "Schedule", status: "unknown", note: "Ask later" },
            ]
            const invalidReasons = [
                null,
                7,
                {},
                { criterion: 5, status: "met", note: "Wrong criterion" },
                { criterion: "Skills", status: "met", note: 5 },
                { criterion: "Skills", status: "invalid", note: "Wrong status" },
            ]
            const detail = `Good skills\n\n${text("hiring.screen.questions", { list: "- First?\n- Second?" })}`

            await expect(
                service.perform(
                    contextOf({
                        label: "fit",
                        score: 72.6,
                        ai_summary: "Good skills",
                        reasons: JSON.stringify([...reasons, ...invalidReasons]),
                        questions: JSON.stringify(["First?", 5, null, "Second?"]),
                    }),
                ),
            ).resolves.toEqual({
                summary: text("hiring.screen.done", { name: "Alex", score: 73, label: text("hiring.scoreLabel.fit") }),
                evidence: "captured",
                detail,
            })

            expect(em.query.mock.calls).toEqual([screenedQuery(73, "fit", JSON.stringify(reasons), detail)])
        })

        it.each([
            { label: "not_fit", score: -5, storedScore: 0, reasons: "broken", questions: "broken" },
            { label: "consider", score: 120, storedScore: 100, reasons: "{}", questions: "{}" },
            { label: "foreign", score: 20, storedScore: 20, reasons: "[]", questions: "[]" },
        ])("normalizes the score and label $label and omits absent detail", async (entry) => {
            const em = mockEntityManager({ query: [SET_SCREENED, []] })
            const { service } = await build(em)
            const label = entry.label === "foreign" ? "consider" : entry.label

            await expect(
                service.perform(
                    contextOf({
                        label: entry.label,
                        score: entry.score,
                        reasons: entry.reasons,
                        questions: entry.questions,
                    }),
                ),
            ).resolves.toEqual({
                summary: text("hiring.screen.done", {
                    name: "Alex",
                    score: entry.storedScore,
                    label: text(`hiring.scoreLabel.${label}`),
                }),
                evidence: "captured",
            })

            expect(em.query.mock.calls).toEqual([screenedQuery(entry.storedScore, label, "[]", null)])
        })

        it("retains a questions-only detail when the model summary is absent", async () => {
            const em = mockEntityManager({ query: [SET_SCREENED, []] })
            const { service } = await build(em)
            const detail = text("hiring.screen.questions", { list: "- Start date?" })

            await expect(service.perform(contextOf({ questions: `["Start date?"]` }))).resolves.toEqual({
                summary: text("hiring.screen.done", {
                    name: "Alex",
                    score: 0,
                    label: text("hiring.scoreLabel.consider"),
                }),
                evidence: "captured",
                detail,
            })

            expect(em.query.mock.calls).toEqual([screenedQuery(0, "consider", "[]", detail)])
        })
    })
})
