import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { HiringCandidatesService } from "./hiring-candidates.service"
import { HiringLinksService } from "./hiring-links.service"
import { HiringSettingsService } from "./hiring-settings.service"
import { HiringWorkbenchService } from "./hiring-workbench.service"
import type { CandidateRecord, HiringSettings } from "./hiring.contracts"
import type { CandidateCvOutput } from "./hiring-operations.contracts"
import type {
    WorkbenchCandidateRow,
    WorkbenchInterviewRow,
    WorkbenchJobRow,
    WorkbenchOfferRow,
} from "./persistence/hiring-workbench.rows"
import {
    COUNT_WAITING_APPROVALS,
    SELECT_ALL_AVAILABILITY,
    SELECT_CANDIDATE_EVENTS,
    SELECT_FIGURES,
    SELECT_WORKBENCH_CANDIDATES,
    SELECT_WORKBENCH_INTERVIEWS,
    SELECT_WORKBENCH_JOBS,
    SELECT_WORKBENCH_MEMBERS,
    SELECT_WORKBENCH_OFFERS,
    SELECT_WORKBENCH_ONBOARDING,
} from "./persistence/hiring-workbench.sql"

const NOW = "2026-10-15T03:00:00.000Z"

const MEMBER: WorkspaceMember = {
    userId: "u-1",
    workspaceId: "ws-1",
    role: "manager",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

const SETTINGS: HiringSettings = {
    workspaceId: "ws-1",
    publicSlug: "tiem-ca-phe",
    retentionDays: 90,
    notifyNewCandidate: true,
    remindInterview: true,
    autoCloseWhenFilled: false,
    applyConsentText: "I agree",
    adTone: "friendly",
}

const CANDIDATE: CandidateRecord = {
    id: "cand-1",
    workspaceId: "ws-1",
    jobId: "job-1",
    name: "Minh",
    phone: "0901000000",
    email: "minh@example.test",
    source: "page",
    conversationId: null,
    cvPath: "ws-1/cv.pdf",
    cvName: "cv-minh.pdf",
    cvMime: "application/pdf",
    answers: [],
    availability: "",
    stage: "applied",
    staffId: null,
}

const cvOf = builder<CandidateCvOutput>({ url: "https://files.test/cv", name: "cv-minh.pdf", mime: "application/pdf" })

const build = async (em: MockEntityManager) => {
    const clock = new FakeClock(NOW)
    const members = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(MEMBER)) })
    const settings = mock<HiringSettingsService>({ ensure: jest.fn(() => Promise.resolve(SETTINGS)) })
    const links = mock<HiringLinksService>({ siteOrigin: jest.fn(() => "https://nivo.vn") })
    const candidates = mock<HiringCandidatesService>({
        requireCandidate: jest.fn(() => Promise.resolve(CANDIDATE)),
        cv: jest.fn(() => Promise.resolve(cvOf())),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            HiringWorkbenchService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: clock },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: HiringSettingsService, useValue: settings },
            { provide: HiringLinksService, useValue: links },
            { provide: HiringCandidatesService, useValue: candidates },
        ],
    }).compile()
    return { service: moduleRef.get(HiringWorkbenchService), members, candidates, links }
}

describe("HiringWorkbenchService", () => {
    describe("bench", () => {
        it("answers the workbench with members' windows, onboarding, approvals and this week's figures", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_WORKBENCH_JOBS, []],
                    [SELECT_WORKBENCH_CANDIDATES, []],
                    [SELECT_WORKBENCH_INTERVIEWS, []],
                    [SELECT_WORKBENCH_OFFERS, []],
                    [
                        SELECT_WORKBENCH_ONBOARDING,
                        [
                            {
                                id: "on-1",
                                candidate_id: "cand-1",
                                title: "Sign the contract",
                                done: true,
                                done_at: new Date("2026-10-14T02:00:00.000Z"),
                                sort: 1,
                            },
                            {
                                id: "on-2",
                                candidate_id: "cand-1",
                                title: "Collect the uniform",
                                done: false,
                                done_at: null,
                                sort: 2,
                            },
                        ],
                    ],
                    [
                        SELECT_WORKBENCH_MEMBERS,
                        [
                            { user_id: "u-1", display_name: "Lan", role: "owner" },
                            { user_id: "u-2", display_name: "Nam", role: "manager" },
                        ],
                    ],
                    [
                        SELECT_ALL_AVAILABILITY,
                        [
                            { member_user_id: "u-1", weekday: 1, start_min: 540, end_min: 720 },
                            { member_user_id: "u-1", weekday: 3, start_min: 780, end_min: 1020 },
                        ],
                    ],
                    [COUNT_WAITING_APPROVALS, [{ n: "4" }]],
                    [
                        SELECT_FIGURES,
                        [
                            {
                                open_roles: "2",
                                total_roles: 3,
                                pipeline: "7",
                                interviews_week: 1,
                                offers_waiting: "0",
                                offers_sent: 2,
                            },
                        ],
                    ],
                ],
            })
            const { service, members, links } = await build(em)

            await expect(service.bench("u-1", "ws-1")).resolves.toEqual({
                nowIso: NOW,
                origin: "https://nivo.vn",
                settings: SETTINGS,
                jobs: [],
                candidates: [],
                interviews: [],
                offers: [],
                onboarding: [
                    {
                        id: "on-1",
                        candidateId: "cand-1",
                        title: "Sign the contract",
                        done: true,
                        doneAt: "2026-10-14T02:00:00.000Z",
                        sort: 1,
                    },
                    {
                        id: "on-2",
                        candidateId: "cand-1",
                        title: "Collect the uniform",
                        done: false,
                        doneAt: null,
                        sort: 2,
                    },
                ],
                members: [
                    {
                        userId: "u-1",
                        name: "Lan",
                        role: "owner",
                        windows: [
                            { weekday: 1, startMin: 540, endMin: 720 },
                            { weekday: 3, startMin: 780, endMin: 1020 },
                        ],
                    },
                    { userId: "u-2", name: "Nam", role: "manager", windows: [] },
                ],
                waitingApprovals: 4,
                figures: {
                    openRoles: 2,
                    totalRoles: 3,
                    pipeline: 7,
                    interviewsWeek: 1,
                    offersWaiting: 0,
                    offersSent: 2,
                },
                meUserId: "u-1",
            })
            expect(members.require).toHaveBeenCalledWith("u-1", "ws-1", ["owner", "manager"])
            expect(em.query).toHaveBeenCalledWith(SELECT_FIGURES, [
                "ws-1",
                "2026-10-11T17:00:00.000Z",
                "2026-10-18T17:00:00.000Z",
            ])
            expect(links.job).not.toHaveBeenCalled()
        })

        it("answers zero figures and approvals when the counts are missing", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_WORKBENCH_JOBS, []],
                    [SELECT_WORKBENCH_CANDIDATES, []],
                    [SELECT_WORKBENCH_INTERVIEWS, []],
                    [SELECT_WORKBENCH_OFFERS, []],
                    [SELECT_WORKBENCH_ONBOARDING, []],
                    [SELECT_WORKBENCH_MEMBERS, []],
                    [SELECT_ALL_AVAILABILITY, []],
                    [COUNT_WAITING_APPROVALS, []],
                    [SELECT_FIGURES, []],
                ],
            })
            const { service } = await build(em)

            const bench = await service.bench("u-1", "ws-1")

            expect(bench.waitingApprovals).toBe(0)
            expect(bench.figures).toEqual({
                openRoles: 0,
                totalRoles: 0,
                pipeline: 0,
                interviewsWeek: 0,
                offersWaiting: 0,
                offersSent: 0,
            })
            expect(bench.members).toEqual([])
        })

        it("stops before reading when the caller is not an owner or manager", async () => {
            const em = mockEntityManager()
            const { service, members } = await build(em)
            const refused = new Error("WORKSPACE_MEMBERS_FORBIDDEN")
            members.require.mockRejectedValue(refused)

            await expect(service.bench("u-9", "ws-1")).rejects.toBe(refused)
            expect(em.query).not.toHaveBeenCalled()
        })
    })

    describe("candidateDetail", () => {
        it("answers the candidate's timeline and CV link", async () => {
            const em = mockEntityManager({
                query: [
                    SELECT_CANDIDATE_EVENTS,
                    [
                        {
                            id: "ev-1",
                            kind: "applied",
                            actor: "Minh",
                            summary: "Applied for Barista",
                            created_at: new Date("2026-10-13T01:00:00.000Z"),
                        },
                        {
                            id: "ev-2",
                            kind: "screened",
                            actor: "NIVO",
                            summary: "82/100",
                            created_at: "2026-10-13T01:05:00Z",
                        },
                    ],
                ],
            })
            const { service, candidates } = await build(em)

            await expect(service.candidateDetail("u-1", "ws-1", "cand-1")).resolves.toEqual({
                events: [
                    {
                        id: "ev-1",
                        kind: "applied",
                        actor: "Minh",
                        summary: "Applied for Barista",
                        createdAt: "2026-10-13T01:00:00.000Z",
                    },
                    {
                        id: "ev-2",
                        kind: "screened",
                        actor: "NIVO",
                        summary: "82/100",
                        createdAt: "2026-10-13T01:05:00.000Z",
                    },
                ],
                cv: { url: "https://files.test/cv", name: "cv-minh.pdf", mime: "application/pdf" },
            })
            expect(candidates.requireCandidate).toHaveBeenCalledWith("ws-1", "cand-1")
            expect(candidates.cv).toHaveBeenCalledWith("u-1", "ws-1", { id: "cand-1" })
            expect(em.query).toHaveBeenCalledWith(SELECT_CANDIDATE_EVENTS, ["ws-1", "cand-1"])
        })

        it("falls back to a default name and type for an unnamed CV", async () => {
            const em = mockEntityManager({ query: [SELECT_CANDIDATE_EVENTS, []] })
            const { service, candidates } = await build(em)
            candidates.cv.mockResolvedValue(cvOf({ name: null, mime: null }))

            await expect(service.candidateDetail("u-1", "ws-1", "cand-1")).resolves.toEqual({
                events: [],
                cv: { url: "https://files.test/cv", name: "cv", mime: "application/pdf" },
            })
        })

        it("answers no CV when the candidate has none", async () => {
            const em = mockEntityManager({ query: [SELECT_CANDIDATE_EVENTS, []] })
            const { service, candidates } = await build(em)
            candidates.cv.mockResolvedValue(cvOf({ url: null, name: null, mime: null }))

            await expect(service.candidateDetail("u-1", "ws-1", "cand-1")).resolves.toEqual({ events: [], cv: null })
        })
    })
})

const job: WorkbenchJobRow = {
    id: "job-1",
    workspace_id: "ws-1",
    slug: "cashier",
    title: "Cashier",
    position: "Counter",
    employment_type: "part_time",
    schedule: "Evenings",
    pay_min_vnd: "30000",
    pay_max_vnd: 40000,
    pay_unit: "hour",
    location: "Market",
    headcount: 2,
    description: "Serve customers",
    requirements: {
        skills: ["POS"],
        experience_years: 1,
        experience_note: "Retail",
        availability: ["Evenings"],
        must_have: ["Payments"],
        nice_to_have: ["Stock"],
    },
    questions: [{ id: "q-1", text: "POS?", type: "yesno", required: true, expect: "yes" }],
    status: "open",
    channels: ["page"],
    ad_variants: { page: "Join us" },
    closes_at: null,
    created_at: new Date(NOW),
    updated_at: NOW,
}
const candidate: WorkbenchCandidateRow = {
    id: "cand-1",
    workspace_id: "ws-1",
    job_id: "job-1",
    name: "Minh",
    phone: "0901000000",
    email: "minh@example.test",
    source: "page",
    conversation_id: null,
    cv_path: "ws-1/cv.pdf",
    cv_name: "cv.pdf",
    cv_mime: "application/pdf",
    cv_size: 123,
    answers: [{ question_id: "q-1", question: "POS?", answer: "yes" }],
    availability: "Evenings",
    score: 90,
    score_label: "fit",
    score_reasons: [{ criterion: "POS", status: "met", note: "Yes" }],
    score_summary: "Ready",
    screened_at: NOW,
    stage: "shortlisted",
    stage_changed_at: new Date(NOW),
    rejected_reason: null,
    notes: "Call",
    staff_id: null,
    created_at: NOW,
}
const interview: WorkbenchInterviewRow = {
    id: "int-1",
    workspace_id: "ws-1",
    candidate_id: "cand-1",
    job_id: "job-1",
    interviewer_user_id: "u-1",
    interviewer_name: "Lan",
    mode: "online",
    location: "https://meet.test",
    duration_min: 30,
    proposed_slots: [{ start: NOW, end: "2026-10-15T03:30:00.000Z" }],
    slot_start: NOW,
    slot_end: "2026-10-15T03:30:00.000Z",
    status: "confirmed",
    token: "token-1",
    work_item_id: "work-1",
    reminder_sent_at: new Date(NOW),
    note: "Bring CV",
    created_at: NOW,
}
const offer: WorkbenchOfferRow = {
    id: "offer-1",
    workspace_id: "ws-1",
    candidate_id: "cand-1",
    job_id: "job-1",
    terms: { title: "Cashier", pay: "40000/hour", start_date: "2026-11-01", probation: "1 month", note: "Welcome" },
    draft: "Offer letter",
    status: "accepted",
    token: "offer-token",
    work_item_id: "work-2",
    sent_via: "email",
    sent_at: NOW,
    expires_at: "2026-11-01T03:00:00.000Z",
    responded_at: new Date(NOW),
    created_at: NOW,
}

describe("HiringWorkbenchService populated views", () => {
    it.each([true, false])("maps additional workbench fields with reasons=%s", async (screened) => {
        const em = mockEntityManager({
            query: [
                [SELECT_WORKBENCH_JOBS, [job]],
                [
                    SELECT_WORKBENCH_CANDIDATES,
                    [{ ...candidate, score_reasons: screened ? candidate.score_reasons : null }],
                ],
                [SELECT_WORKBENCH_INTERVIEWS, [interview]],
                [SELECT_WORKBENCH_OFFERS, [offer]],
                [SELECT_WORKBENCH_ONBOARDING, []],
                [SELECT_WORKBENCH_MEMBERS, []],
                [SELECT_ALL_AVAILABILITY, []],
                [COUNT_WAITING_APPROVALS, []],
                [SELECT_FIGURES, []],
            ],
        })
        const { service, links } = await build(em)
        links.job.mockReturnValue("https://nivo.vn/tiem-ca-phe/cashier")

        const bench = await service.bench("u-1", "ws-1")

        expect(bench.jobs).toEqual([
            expect.objectContaining({
                id: "job-1",
                adVariants: { page: "Join us" },
                createdAt: NOW,
                updatedAt: NOW,
                publicUrl: "https://nivo.vn/tiem-ca-phe/cashier",
            }),
        ])
        expect(bench.candidates).toEqual([
            expect.objectContaining({
                id: "cand-1",
                cvSize: 123,
                score: 90,
                scoreLabel: "fit",
                scoreReasons: screened ? [{ criterion: "POS", status: "met", note: "Yes" }] : [],
                scoreSummary: "Ready",
                screenedAt: NOW,
                stageChangedAt: NOW,
                rejectedReason: null,
                notes: "Call",
                createdAt: NOW,
            }),
        ])
        expect(bench.interviews).toEqual([
            expect.objectContaining({ id: "int-1", reminderSentAt: NOW, createdAt: NOW }),
        ])
        expect(bench.offers).toEqual([
            expect.objectContaining({
                id: "offer-1",
                sentVia: "email",
                sentAt: NOW,
                respondedAt: NOW,
                createdAt: NOW,
            }),
        ])
        expect(links.job.mock.calls).toEqual([["tiem-ca-phe", "cashier"]])
    })
})
