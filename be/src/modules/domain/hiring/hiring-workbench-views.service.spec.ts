import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkItemsDecisionsReadService } from "@modules/domain/work-items"
import { MemberRosterService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityRowBuilder } from "@tests/fixtures/builders/entity-row.builder"
import { HiringCandidatesService } from "./hiring-candidates.service"
import { HiringLinksService } from "./hiring-links.service"
import { HiringSettingsService } from "./hiring-settings.service"
import { HiringWorkbenchService } from "./hiring-workbench.service"
import type { CandidateRecord, HiringSettings } from "./hiring.contracts"
import type { CandidateCvOutput } from "./hiring-operations.contracts"
import {
    HiringAvailabilityEntity,
    HiringCandidateEntity,
    HiringInterviewEntity,
    HiringJobEntity,
    HiringOfferEntity,
    HiringOnboardingEntity,
} from "./persistence/entities"

type RosterMember = Awaited<ReturnType<MemberRosterService["oldestOf"]>>[number]

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

const build = async (em: MockEntityManager, waiting = 0, members: ReadonlyArray<RosterMember> = []) => {
    const clock = new FakeClock(NOW)
    const roster = mock<MemberRosterService>()
    roster.oldestOf.mockResolvedValue([...members])
    const decisions = mock<WorkItemsDecisionsReadService>()
    decisions.countWaiting.mockResolvedValue(waiting)
    const memberService = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(MEMBER)) })
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
            { provide: WorkspaceMembersService, useValue: memberService },
            { provide: MemberRosterService, useValue: roster },
            { provide: WorkItemsDecisionsReadService, useValue: decisions },
            { provide: HiringSettingsService, useValue: settings },
            { provide: HiringLinksService, useValue: links },
            { provide: HiringCandidatesService, useValue: candidates },
        ],
    }).compile()
    return { service: moduleRef.get(HiringWorkbenchService), members: memberService, candidates, links }
}

/** The counts the ribbon and the approvals read, in the order the service asks for them. */
const counts = (figures: ReadonlyArray<number>) =>
    [
        [HiringJobEntity, figures[0] ?? 0],
        [HiringJobEntity, figures[1] ?? 0],
        [HiringCandidateEntity, figures[2] ?? 0],
        [HiringInterviewEntity, figures[3] ?? 0],
        [HiringOfferEntity, figures[4] ?? 0],
        [HiringOfferEntity, figures[5] ?? 0],
    ] as const

const jobRow = entityRowBuilder<HiringJobEntity>({
    id: "job-1",
    workspaceId: "ws-1",
    slug: "cashier",
    title: "Cashier",
    position: "Counter",
    employmentType: "part_time",
    schedule: "Evenings",
    payMinVnd: "30000",
    payMaxVnd: "40000",
    payUnit: "hour",
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
    adVariants: { page: "Join us" },
    closesAt: null,
    createdBy: null,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
})

const candidateRow = entityRowBuilder<HiringCandidateEntity>({
    id: "cand-1",
    workspaceId: "ws-1",
    jobId: "job-1",
    name: "Minh",
    phone: "0901000000",
    email: "minh@example.test",
    source: "page",
    conversationId: null,
    cvPath: "ws-1/cv.pdf",
    cvName: "cv.pdf",
    cvMime: "application/pdf",
    cvSize: 123,
    answers: [{ question_id: "q-1", question: "POS?", answer: "yes" }],
    availability: "Evenings",
    score: 90,
    scoreLabel: "fit",
    scoreReasons: [{ criterion: "POS", status: "met", note: "Yes" }],
    scoreSummary: "Ready",
    screenedAt: new Date(NOW),
    stage: "shortlisted",
    stageChangedAt: new Date(NOW),
    rejectedReason: null,
    notes: "Call",
    staffId: null,
    createdAt: new Date(NOW),
})

const interviewRow = entityRowBuilder<HiringInterviewEntity>({
    id: "int-1",
    workspaceId: "ws-1",
    candidateId: "cand-1",
    jobId: "job-1",
    interviewerUserId: "u-1",
    interviewerName: "Lan",
    mode: "online",
    location: "https://meet.test",
    durationMin: 30,
    proposedSlots: [{ start: NOW, end: "2026-10-15T03:30:00.000Z" }],
    slotStart: new Date(NOW),
    slotEnd: new Date("2026-10-15T03:30:00.000Z"),
    status: "confirmed",
    token: "token-1",
    workItemId: "work-1",
    reminderSentAt: new Date(NOW),
    note: "Bring CV",
    createdAt: new Date(NOW),
})

const offerRow = entityRowBuilder<HiringOfferEntity>({
    id: "offer-1",
    workspaceId: "ws-1",
    candidateId: "cand-1",
    jobId: "job-1",
    terms: { title: "Cashier", pay: "40000/hour", start_date: "2026-11-01", probation: "1 month", note: "Welcome" },
    draft: "Offer letter",
    status: "accepted",
    token: "offer-token",
    workItemId: "work-2",
    sentVia: "email",
    sentAt: new Date(NOW),
    expiresAt: new Date("2026-11-01T03:00:00.000Z"),
    respondedAt: new Date(NOW),
    createdBy: null,
    createdAt: new Date(NOW),
})

describe("HiringWorkbenchService populated views", () => {
    it.each([true, false])("maps additional workbench fields with reasons=%s", async (screened) => {
        const em = mockEntityManager({
            find: [
                [HiringJobEntity, [jobRow()]],
                [HiringCandidateEntity, [candidateRow(screened ? {} : { scoreReasons: null })]],
                [HiringInterviewEntity, [interviewRow()]],
                [HiringOfferEntity, [offerRow()]],
                [HiringOnboardingEntity, []],
                [HiringAvailabilityEntity, []],
            ],
            count: counts([]),
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
