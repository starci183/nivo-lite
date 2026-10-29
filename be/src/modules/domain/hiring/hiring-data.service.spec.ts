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
import { settingsRow, jobRow, candidateRow, interviewRow, offerRow, availabilityRow } from "@tests/fixtures/builders/hiring-rows.builder"
import { Test } from "@nestjs/testing"
import { Between, In, IsNull, LessThan } from "typeorm"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { WorkItemsDecisionsReadService } from "@modules/domain/work-items"
import { MemberRosterService, WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentConversationEntity } from "@modules/domain/agent-conversations"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { conversationOf } from "@tests/fixtures/builders/agent-conversations.builder"
import { HiringDataService } from "./hiring-data.service"
import {
    HiringAvailabilityEntity,
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

describe("HiringDataService lists", () => {
    it("maps the chat jobs of the workspace, open first created, five at most", async () => {
        const em = mockEntityManager()
        const [jobsRead] = queueQueryBuilders(em, [{ getMany: [jobRow(), jobRow({ id: "job-2" })] }])
        const service = await build(em)

        await expect(service.chatJobs("ws-1")).resolves.toEqual([jobFixture, { ...jobFixture, id: "job-2" }])
        expect(jobsRead?.callsOf("where")).toEqual([["job.workspaceId = :workspaceId", { workspaceId: "ws-1" }]])
        expect(jobsRead?.callsOf("andWhere")).toEqual([
            ["job.status = :status", { status: "open" }],
            [":channel = ANY(job.channels)", { channel: "chat" }],
        ])
        expect(jobsRead?.callsOf("orderBy")).toEqual([["job.createdAt", "ASC"]])
        expect(jobsRead?.callsOf("take")).toEqual([[5]])
    })

    it("maps the confirmed interviews that start in a window and were not reminded", async () => {
        const from = new Date("2026-10-14T00:00:00.000Z")
        const until = new Date("2026-10-14T02:00:00.000Z")
        const em = mockEntityManager({
            find: [HiringInterviewEntity, [interviewRow(), interviewRow({ id: "interview-2" })]],
        })
        const service = await build(em)

        await expect(service.dueReminders("ws-1", from, until)).resolves.toEqual([
            interviewFixture,
            { ...interviewFixture, id: "interview-2" },
        ])
        expect(em.find.mock.calls).toEqual([
            [
                HiringInterviewEntity,
                {
                    where: {
                        workspaceId: "ws-1",
                        status: "confirmed",
                        reminderSentAt: IsNull(),
                        slotStart: Between(from, until),
                    },
                    order: { slotStart: "ASC" },
                    take: 200,
                },
            ],
        ])
    })

    it("maps the weekly availability windows of a member", async () => {
        const em = mockEntityManager({
            find: [
                HiringAvailabilityEntity,
                [availabilityRow(), availabilityRow({ id: "window-2", weekday: 2, startMin: 600, endMin: 900 })],
            ],
        })
        const service = await build(em)

        await expect(service.availability("ws-1", "user-1")).resolves.toEqual([
            { weekday: 1, startMin: 480, endMin: 720 },
            { weekday: 2, startMin: 600, endMin: 900 },
        ])
        expect(em.find.mock.calls).toEqual([
            [
                HiringAvailabilityEntity,
                {
                    select: { weekday: true, startMin: true, endMin: true },
                    where: { workspaceId: "ws-1", memberUserId: "user-1" },
                    take: 50,
                },
            ],
        ])
    })

    it("maps the interviewers, the owner first", async () => {
        const service = await build(mockEntityManager())
        roster.oldestOf.mockResolvedValue([
            { userId: "user-1", role: "staff", displayName: "Blair", status: "active", createdAt: CREATED },
            { userId: "gone-1", role: "staff", displayName: "Gone", status: "disabled", createdAt: CREATED },
            { userId: "owner-1", role: "owner", displayName: "Owner", status: "active", createdAt: CREATED },
        ])

        await expect(service.interviewers("ws-1")).resolves.toEqual([
            { userId: "owner-1", name: "Owner", isOwner: true },
            { userId: "user-1", name: "Blair", isOwner: false },
        ])
        expect(roster.oldestOf).toHaveBeenCalledWith("ws-1", 20)
    })

    it("reads the live job ids and the retention due ids with the bounds of the old queries", async () => {
        const cutoff = new Date("2026-07-15T00:00:00.000Z")
        const em = mockEntityManager({
            find: [
                [HiringJobEntity, [jobRow({ id: "job-1" }), jobRow({ id: "job-2" })]],
                [HiringCandidateEntity, [candidateRow({ id: "candidate-1" }), candidateRow({ id: "candidate-2" })]],
            ],
        })
        const service = await build(em)

        await expect(service.liveJobIds("ws-1")).resolves.toEqual(["job-1", "job-2"])
        await expect(service.retentionDue("ws-1", cutoff)).resolves.toEqual(["candidate-1", "candidate-2"])
        expect(em.find.mock.calls).toEqual([
            [
                HiringJobEntity,
                { select: { id: true }, where: { workspaceId: "ws-1", status: In(["open", "paused"]) }, take: 500 },
            ],
            [
                HiringCandidateEntity,
                {
                    select: { id: true },
                    where: {
                        workspaceId: "ws-1",
                        stage: In(["rejected", "withdrawn"]),
                        stageChangedAt: LessThan(cutoff),
                    },
                    order: { stageChangedAt: "ASC" },
                    take: 200,
                },
            ],
        ])
    })
})

describe("HiringDataService lists", () => {
    it("reports whether open interviews and active offers have a row", async () => {
        const em = mockEntityManager({
            exists: [
                [HiringInterviewEntity, true],
                [HiringInterviewEntity, false],
                [HiringOfferEntity, true],
                [HiringOfferEntity, false],
            ],
        })
        const service = await build(em)

        await expect(service.hasOpenInterview("candidate-1")).resolves.toBe(true)
        await expect(service.hasOpenInterview("candidate-2")).resolves.toBe(false)
        await expect(service.hasActiveOffer("candidate-1")).resolves.toBe(true)
        await expect(service.hasActiveOffer("candidate-2")).resolves.toBe(false)
        const open = (candidateId: string) => ({ where: { candidateId, status: In(["proposed", "confirmed"]) } })
        const active = (candidateId: string) => ({ where: { candidateId, status: In(["draft", "waiting", "sent"]) } })
        expect(em.exists.mock.calls).toEqual([
            [HiringInterviewEntity, open("candidate-1")],
            [HiringInterviewEntity, open("candidate-2")],
            [HiringOfferEntity, active("candidate-1")],
            [HiringOfferEntity, active("candidate-2")],
        ])
    })

    it("uses confirmed bounds and falls back to proposed slots for every incomplete bound", async () => {
        const first = { start: "2026-10-14T01:00:00.000Z", end: "2026-10-14T01:30:00.000Z" }
        const second = { start: "2026-10-14T02:00:00.000Z", end: "2026-10-14T02:30:00.000Z" }
        const third = { start: "2026-10-14T03:00:00.000Z", end: "2026-10-14T03:30:00.000Z" }
        const fourth = { start: "2026-10-14T04:00:00.000Z", end: "2026-10-14T04:30:00.000Z" }
        const confirmed = {
            slotStart: new Date(first.start),
            slotEnd: new Date(first.end),
            proposedSlots: [{ start: "ignored", end: "ignored" }],
        }
        const em = mockEntityManager({
            find: [
                HiringInterviewEntity,
                [
                    interviewRow(confirmed),
                    interviewRow({ ...confirmed, status: "proposed", proposedSlots: [second] }),
                    interviewRow({ ...confirmed, slotStart: null, proposedSlots: [third] }),
                    interviewRow({ ...confirmed, slotEnd: null, proposedSlots: [fourth] }),
                    interviewRow({ status: "proposed", slotStart: null, slotEnd: null, proposedSlots: null }),
                ],
            ],
        })
        const service = await build(em)

        await expect(service.busy("ws-1", "user-1")).resolves.toEqual([first, second, third, fourth])
        expect(em.find.mock.calls).toEqual([
            [
                HiringInterviewEntity,
                {
                    select: { slotStart: true, slotEnd: true, proposedSlots: true, status: true },
                    where: { workspaceId: "ws-1", interviewerUserId: "user-1", status: In(["proposed", "confirmed"]) },
                    take: 500,
                },
            ],
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
