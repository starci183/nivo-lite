import { benchJobRow, benchCandidateRow, benchInterviewRow, benchOfferRow } from "@tests/fixtures/builders/hiring-rows.builder"
import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { And, LessThan, MoreThanOrEqual } from "typeorm"
import { WorkItemsDecisionsReadService } from "@modules/domain/work-items"
import { MemberRosterService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { CREATED } from "@tests/fixtures/builders/hiring-data.builder"
import { entityRowBuilder, namedCalls, plain } from "@tests/fixtures/builders/entity-row.builder"
import { HiringCandidatesService } from "./hiring-candidates.service"
import { HiringLinksService } from "./hiring-links.service"
import { HiringSettingsService } from "./hiring-settings.service"
import { HiringWorkbenchService } from "./hiring-workbench.service"
import type { CandidateRecord, HiringSettings } from "./hiring.contracts"
import type { CandidateCvOutput } from "./hiring-operations.contracts"
import {
    HiringAvailabilityEntity,
    HiringCandidateEntity,
    HiringEventEntity,
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

const onboarding = entityRowBuilder<HiringOnboardingEntity>({
    id: "on-1",
    workspaceId: "ws-1",
    candidateId: "cand-1",
    title: "Sign the contract",
    done: false,
    doneAt: null,
    sort: 1,
    createdAt: CREATED,
})

const windowRow = entityRowBuilder<HiringAvailabilityEntity>({
    id: "window-1",
    workspaceId: "ws-1",
    memberUserId: "u-1",
    weekday: 1,
    startMin: 540,
    endMin: 720,
})

const eventOf = entityRowBuilder<HiringEventEntity>({
    id: "ev-1",
    workspaceId: "ws-1",
    candidateId: "cand-1",
    kind: "applied",
    actor: "Minh",
    summary: "Applied for Barista",
    createdAt: new Date("2026-10-13T01:00:00.000Z"),
})

const bounds = {
    from: new Date("2026-10-11T17:00:00.000Z"),
    to: new Date("2026-10-18T17:00:00.000Z"),
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

const ROSTER: ReadonlyArray<RosterMember> = [
    { userId: "u-1", displayName: "Lan", role: "owner", status: "active", createdAt: CREATED },
    { userId: "u-2", displayName: "Nam", role: "manager", status: "active", createdAt: CREATED },
    { userId: "u-3", displayName: "Gone", role: "staff", status: "disabled", createdAt: CREATED },
]

const workbenchData = () =>
    ({
        find: [
            [HiringJobEntity, []],
            [HiringCandidateEntity, []],
            [HiringInterviewEntity, []],
            [HiringOfferEntity, []],
            [
                HiringOnboardingEntity,
                [
                    onboarding({ done: true, doneAt: new Date("2026-10-14T02:00:00.000Z") }),
                    onboarding({ id: "on-2", title: "Collect the uniform", sort: 2 }),
                ],
            ],
            [
                HiringAvailabilityEntity,
                [windowRow(), windowRow({ id: "window-2", weekday: 3, startMin: 780, endMin: 1020 })],
            ],
        ],
        count: counts([2, 3, 7, 1, 0, 2]),
    }) as const

describe("HiringWorkbenchService", () => {
    describe("bench", () => {
        it("answers the workbench with members' windows, onboarding, approvals and this week's figures", async () => {
            const em = mockEntityManager(workbenchData())
            const { service, members, links } = await build(em, 4, ROSTER)

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
            expect(em.count).toHaveBeenCalledWith(HiringInterviewEntity, {
                where: {
                    workspaceId: "ws-1",
                    status: "confirmed",
                    slotStart: And(MoreThanOrEqual(bounds.from), LessThan(bounds.to)),
                },
            })
            expect(links.job).not.toHaveBeenCalled()
        })
    })
})

describe("HiringWorkbenchService", () => {
    describe("bench", () => {
        it("reads each list newest first and within the bounds of the old queries", async () => {
            const em = mockEntityManager(workbenchData())
            const { service } = await build(em)

            await service.bench("u-1", "ws-1")

            expect(namedCalls(em.find.mock.calls)).toEqual([
                ["HiringJobEntity", { where: { workspaceId: "ws-1" }, order: { createdAt: "DESC" }, take: 500 }],
                ["HiringCandidateEntity", { where: { workspaceId: "ws-1" }, order: { createdAt: "DESC" }, take: 1000 }],
                ["HiringInterviewEntity", { where: { workspaceId: "ws-1" }, order: { createdAt: "DESC" }, take: 300 }],
                ["HiringOfferEntity", { where: { workspaceId: "ws-1" }, order: { createdAt: "DESC" }, take: 300 }],
                ["HiringOnboardingEntity", { where: { workspaceId: "ws-1" }, order: { sort: "ASC" }, take: 2000 }],
                ["HiringAvailabilityEntity", { where: { workspaceId: "ws-1" }, take: 2000 }],
            ])
            expect(namedCalls(em.count.mock.calls)).toEqual([
                ["HiringJobEntity", { where: { workspaceId: "ws-1", status: "open" } }],
                ["HiringJobEntity", { where: { workspaceId: "ws-1" } }],
                ["HiringCandidateEntity", { where: plain(expect.objectContaining({ workspaceId: "ws-1" })) }],
                [
                    "HiringInterviewEntity",
                    { where: plain(expect.objectContaining({ workspaceId: "ws-1", status: "confirmed" })) },
                ],
                ["HiringOfferEntity", { where: { workspaceId: "ws-1", status: "waiting" } }],
                ["HiringOfferEntity", { where: { workspaceId: "ws-1", status: "sent" } }],
            ])
        })
    })
})

describe("HiringWorkbenchService", () => {
    describe("bench", () => {
        it("answers zero figures and approvals when there is nothing to count", async () => {
            const em = mockEntityManager({
                find: [
                    [HiringJobEntity, []],
                    [HiringCandidateEntity, []],
                    [HiringInterviewEntity, []],
                    [HiringOfferEntity, []],
                    [HiringOnboardingEntity, []],
                    [HiringAvailabilityEntity, []],
                ],
                count: counts([]),
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
            expect(em.find).not.toHaveBeenCalled()
            expect(em.count).not.toHaveBeenCalled()
        })
    })
})

describe("HiringWorkbenchService", () => {
    describe("candidateDetail", () => {
        it("answers the candidate's timeline and CV link", async () => {
            const em = mockEntityManager({
                find: [
                    HiringEventEntity,
                    [
                        eventOf({}),
                        eventOf({
                            id: "ev-2",
                            kind: "screened",
                            actor: "NIVO",
                            summary: "82/100",
                            createdAt: new Date("2026-10-13T01:05:00Z"),
                        }),
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
            expect(em.find).toHaveBeenCalledWith(HiringEventEntity, {
                where: { workspaceId: "ws-1", candidateId: "cand-1" },
                order: { createdAt: "DESC" },
                take: 60,
            })
        })

        it("falls back to a default name and type for an unnamed CV", async () => {
            const em = mockEntityManager({ find: [HiringEventEntity, []] })
            const { service, candidates } = await build(em)
            candidates.cv.mockResolvedValue(cvOf({ name: null, mime: null }))

            await expect(service.candidateDetail("u-1", "ws-1", "cand-1")).resolves.toEqual({
                events: [],
                cv: { url: "https://files.test/cv", name: "cv", mime: "application/pdf" },
            })
        })

        it("answers no CV when the candidate has none", async () => {
            const em = mockEntityManager({ find: [HiringEventEntity, []] })
            const { service, candidates } = await build(em)
            candidates.cv.mockResolvedValue(cvOf({ url: null, name: null, mime: null }))

            await expect(service.candidateDetail("u-1", "ws-1", "cand-1")).resolves.toEqual({ events: [], cv: null })
        })
    })
})

describe("HiringWorkbenchService populated views", () => {
    it.each([true, false])("maps additional workbench fields with reasons=%s", async (screened) => {
        const em = mockEntityManager({
            find: [
                [HiringJobEntity, [benchJobRow()]],
                [HiringCandidateEntity, [benchCandidateRow(screened ? {} : { scoreReasons: null })]],
                [HiringInterviewEntity, [benchInterviewRow()]],
                [HiringOfferEntity, [benchOfferRow()]],
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
