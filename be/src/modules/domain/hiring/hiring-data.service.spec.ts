import type { HiringSettings, JobRecord, CandidateRecord, InterviewRecord, OfferRecord } from "./hiring.contracts"
import {
    CREATED,
    LINK_TOKEN,
    settings as settingsFixture,
    job as jobFixture,
    candidate as candidateFixture,
    interview as interviewFixture,
    offer as offerFixture,
} from "@tests/fixtures/builders/hiring-data.builder"
import { Test } from "@nestjs/testing"
import { WorkItemsDecisionsReadService } from "@modules/domain/work-items"
import { MemberRosterService, WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentConversationEntity } from "@modules/domain/agent-conversations"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { conversationOf } from "@tests/fixtures/builders/agent-conversations.builder"
import { entityRowBuilder } from "@tests/fixtures/builders/entity-row.builder"
import { HiringDataService } from "./hiring-data.service"
import {
    HiringCandidateEntity,
    HiringInterviewEntity,
    HiringJobEntity,
    HiringOfferEntity,
    HiringSettingEntity,
} from "./persistence/entities"

const settings: HiringSettings = settingsFixture
const job: JobRecord = jobFixture
const candidate: CandidateRecord = candidateFixture
const interview: InterviewRecord = interviewFixture
const offer: OfferRecord = offerFixture

const seatOf = (userId: string, displayName: string) => ({
    memberId: "m-1",
    userId,
    role: "staff" as const,
    displayName,
    status: "active" as const,
})

const settingsRow = entityRowBuilder<HiringSettingEntity>({
    workspaceId: "ws-1",
    publicSlug: "shop",
    retentionDays: 90,
    notifyNewCandidate: true,
    remindInterview: false,
    autoCloseWhenFilled: true,
    applyConsentText: "Consent example",
    adTone: "Friendly",
    updatedAt: CREATED,
})

const jobRow = entityRowBuilder<HiringJobEntity>({
    id: "job-1",
    workspaceId: "ws-1",
    slug: "barista",
    title: "Barista",
    position: "Coffee maker",
    employmentType: "part_time",
    schedule: "Monday morning",
    payMinVnd: "30000",
    payMaxVnd: "40000",
    payUnit: "hour",
    location: "Main shop",
    headcount: 2,
    description: "Make coffee",
    requirements: null,
    questions: null,
    status: "open",
    channels: ["page", "chat"],
    adVariants: null,
    closesAt: new Date("2026-10-20T08:00:00+07:00"),
    createdBy: null,
    createdAt: CREATED,
    updatedAt: CREATED,
})

const candidateRow = entityRowBuilder<HiringCandidateEntity>({
    id: "candidate-1",
    workspaceId: "ws-1",
    jobId: "job-1",
    name: "Alex",
    phone: "0912345678",
    email: "alex@example.test",
    source: "page",
    conversationId: null,
    cvPath: null,
    cvName: null,
    cvMime: null,
    cvSize: null,
    answers: [{ question_id: "q-1", question: "Experience?", answer: "Two years" }],
    availability: "Monday morning",
    score: null,
    scoreLabel: null,
    scoreReasons: [],
    scoreSummary: null,
    screenedAt: null,
    stage: "applied",
    stageChangedAt: CREATED,
    rejectedReason: null,
    notes: "",
    createdAt: CREATED,
    staffId: null,
})

const interviewRow = entityRowBuilder<HiringInterviewEntity>({
    id: "interview-1",
    workspaceId: "ws-1",
    candidateId: "candidate-1",
    jobId: "job-1",
    interviewerUserId: "user-1",
    interviewerName: "Blair",
    mode: "in_person",
    location: "Main shop",
    durationMin: 30,
    proposedSlots: [{ start: "2026-10-14T01:00:00.000Z", end: "2026-10-14T01:30:00.000Z" }],
    slotStart: new Date("2026-10-14T01:00:00.000Z"),
    slotEnd: new Date("2026-10-14T01:30:00.000Z"),
    status: "confirmed",
    token: LINK_TOKEN,
    workItemId: "work-1",
    reminderSentAt: null,
    note: "Bring examples",
    createdAt: CREATED,
})

const offerRow = entityRowBuilder<HiringOfferEntity>({
    id: "offer-1",
    workspaceId: "ws-1",
    candidateId: "candidate-1",
    jobId: "job-1",
    terms: {
        title: "Barista",
        pay: "40000 per hour",
        probation: "One month",
        note: "Welcome",
        start_date: "2026-10-20",
    },
    draft: "Letter draft",
    status: "sent",
    token: LINK_TOKEN,
    workItemId: "work-1",
    sentVia: null,
    sentAt: null,
    expiresAt: new Date("2026-10-21T08:00:00+07:00"),
    respondedAt: null,
    createdBy: null,
    createdAt: CREATED,
})

const seats = mock<WorkspaceMemberSeatsService>()
const roster = mock<MemberRosterService>()
const decisions = mock<WorkItemsDecisionsReadService>()

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            HiringDataService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: MemberRosterService, useValue: roster },
            { provide: WorkItemsDecisionsReadService, useValue: decisions },
        ],
    }).compile()
    return moduleRef.get(HiringDataService)
}

describe("HiringDataService", () => {
    it.each([true, false])("reads mapped records with a row present: %s", async (present) => {
        const em = mockEntityManager({
            findOne: [
                [HiringSettingEntity, present ? settingsRow() : null],
                [HiringSettingEntity, present ? settingsRow() : null],
                [HiringJobEntity, present ? jobRow() : null],
                [HiringJobEntity, present ? jobRow() : null],
                [HiringCandidateEntity, present ? candidateRow() : null],
                [HiringInterviewEntity, present ? interviewRow() : null],
                [HiringOfferEntity, present ? offerRow() : null],
                [HiringOfferEntity, present ? offerRow() : null],
            ],
        })
        const service = await build(em)

        await expect(service.settings("ws-1")).resolves.toEqual(present ? settings : undefined)
        await expect(service.settingsBySlug("shop")).resolves.toEqual(present ? settings : undefined)
        await expect(service.job("ws-1", "job-1")).resolves.toEqual(present ? job : undefined)
        await expect(service.jobBySlug("ws-1", "barista")).resolves.toEqual(present ? job : undefined)
        await expect(service.candidate("ws-1", "candidate-1")).resolves.toEqual(present ? candidate : undefined)
        await expect(service.interviewByToken("interview-token")).resolves.toEqual(present ? interview : undefined)
        await expect(service.offer("ws-1", "offer-1")).resolves.toEqual(present ? offer : undefined)
        await expect(service.offerByToken("offer-token")).resolves.toEqual(present ? offer : undefined)
        expect(em.findOne.mock.calls).toEqual([
            [HiringSettingEntity, { where: { workspaceId: "ws-1" } }],
            [HiringSettingEntity, { where: { publicSlug: "shop" } }],
            [HiringJobEntity, { where: { workspaceId: "ws-1", id: "job-1" } }],
            [HiringJobEntity, { where: { workspaceId: "ws-1", slug: "barista" } }],
            [HiringCandidateEntity, { where: { workspaceId: "ws-1", id: "candidate-1" } }],
            [HiringInterviewEntity, { where: { token: "interview-token" } }],
            [HiringOfferEntity, { where: { workspaceId: "ws-1", id: "offer-1" } }],
            [HiringOfferEntity, { where: { token: "offer-token" } }],
        ])
    })
})

describe("HiringDataService", () => {
    it("returns the tick workspace, candidate head, job head and member name, or undefined when a row is absent", async () => {
        const em = mockEntityManager({
            findOne: [
                [HiringSettingEntity, settingsRow()],
                [HiringCandidateEntity, candidateRow()],
                [HiringJobEntity, jobRow()],
                [HiringSettingEntity, null],
                [HiringCandidateEntity, null],
                [HiringJobEntity, null],
            ],
        })
        const service = await build(em)
        seats.activeSeatOfUser.mockResolvedValueOnce(seatOf("user-1", "Blair")).mockResolvedValueOnce(null)

        await expect(service.tickWorkspace("ws-1")).resolves.toEqual({
            workspaceId: "ws-1",
            retentionDays: 90,
            remindInterview: false,
        })
        await expect(service.candidateHead("candidate-1")).resolves.toEqual({ id: "candidate-1", name: "Alex" })
        await expect(service.jobHead("job-1")).resolves.toEqual({
            title: "Barista",
            location: "Main shop",
            position: "Coffee maker",
        })
        await expect(service.memberName("ws-1", "user-1")).resolves.toEqual({ userId: "user-1", displayName: "Blair" })
        await expect(service.tickWorkspace("ws-2")).resolves.toBeUndefined()
        await expect(service.candidateHead("candidate-2")).resolves.toBeUndefined()
        await expect(service.jobHead("job-2")).resolves.toBeUndefined()
        await expect(service.memberName("ws-2", "user-2")).resolves.toBeUndefined()
        const tickSelect = { workspaceId: true, retentionDays: true, remindInterview: true }
        const jobSelect = { title: true, location: true, position: true }
        expect(em.findOne.mock.calls).toEqual([
            [HiringSettingEntity, { select: tickSelect, where: { workspaceId: "ws-1" } }],
            [HiringCandidateEntity, { select: { id: true, name: true }, where: { id: "candidate-1" } }],
            [HiringJobEntity, { select: jobSelect, where: { id: "job-1" } }],
            [HiringSettingEntity, { select: tickSelect, where: { workspaceId: "ws-2" } }],
            [HiringCandidateEntity, { select: { id: true, name: true }, where: { id: "candidate-2" } }],
            [HiringJobEntity, { select: jobSelect, where: { id: "job-2" } }],
        ])
        expect(seats.activeSeatOfUser.mock.calls).toEqual([
            ["ws-1", "user-1"],
            ["ws-2", "user-2"],
        ])
    })
})

describe("HiringDataService", () => {
    it("combines candidate and job heads only when both exist", async () => {
        const em = mockEntityManager({
            findOne: [
                [HiringCandidateEntity, candidateRow()],
                [HiringJobEntity, jobRow()],
                [HiringCandidateEntity, null],
                [HiringJobEntity, jobRow()],
                [HiringCandidateEntity, candidateRow()],
                [HiringJobEntity, null],
                [HiringCandidateEntity, null],
                [HiringJobEntity, null],
            ],
        })
        const service = await build(em)

        await expect(service.heads("candidate-1", "job-1")).resolves.toEqual({
            candidateName: "Alex",
            jobTitle: "Barista",
            jobLocation: "Main shop",
        })
        await expect(service.heads("candidate-2", "job-1")).resolves.toBeUndefined()
        await expect(service.heads("candidate-1", "job-2")).resolves.toBeUndefined()
        await expect(service.heads("candidate-2", "job-2")).resolves.toBeUndefined()
        expect(em.findOne.mock.calls.map(([entity, options]) => [entity, options?.where])).toEqual([
            [HiringCandidateEntity, { id: "candidate-1" }],
            [HiringJobEntity, { id: "job-1" }],
            [HiringCandidateEntity, { id: "candidate-2" }],
            [HiringJobEntity, { id: "job-1" }],
            [HiringCandidateEntity, { id: "candidate-1" }],
            [HiringJobEntity, { id: "job-2" }],
            [HiringCandidateEntity, { id: "candidate-2" }],
            [HiringJobEntity, { id: "job-2" }],
        ])
    })
})

describe("HiringDataService", () => {
    it("reads the channel of a conversation, and null when there is no conversation", async () => {
        const em = mockEntityManager({
            findOne: [
                [AgentConversationEntity, conversationOf({ channel: "telegram" })],
                [AgentConversationEntity, null],
            ],
        })
        const service = await build(em)

        await expect(service.conversationChannel("conversation-1")).resolves.toBe("telegram")
        await expect(service.conversationChannel("conversation-3")).resolves.toBeNull()
        expect(em.findOne.mock.calls).toEqual([
            [AgentConversationEntity, { select: { channel: true }, where: { id: "conversation-1" } }],
            [AgentConversationEntity, { select: { channel: true }, where: { id: "conversation-3" } }],
        ])
    })

    it("counts the asks of a prefix with the prefix wildcard", async () => {
        const service = await build(mockEntityManager())
        decisions.countWithKeyPrefix.mockResolvedValueOnce(3).mockResolvedValueOnce(2).mockResolvedValueOnce(0)

        await expect(service.askAttempts("ws-1", "send_offer", "offer:offer-1:")).resolves.toBe(3)
        await expect(service.askAttempts("ws-1", "invite_interview", "interview:candidate-1:")).resolves.toBe(2)
        await expect(service.askAttempts("ws-2", "send_offer", "offer:offer-2:")).resolves.toBe(0)
        expect(decisions.countWithKeyPrefix.mock.calls).toEqual([
            ["ws-1", "offer:offer-1:", "send_offer"],
            ["ws-1", "interview:candidate-1:", "invite_interview"],
            ["ws-2", "offer:offer-2:", "send_offer"],
        ])
    })
})

describe("HiringDataService link issuance", () => {
    it("issues independent 16-byte opaque tokens in the existing link format without database generation", async () => {
        const em = mockEntityManager()
        const service = await build(em)
        const first = await service.newToken()
        const second = await service.newToken()
        expect(first).toMatch(/^[a-f0-9]{32}$/u)
        expect(second).toMatch(/^[a-f0-9]{32}$/u)
        expect(first).not.toBe(second)
        expect(em.query).not.toHaveBeenCalled()
    })
})
