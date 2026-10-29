import {
    CREATED,
    LINK_TOKEN,
    job as jobFixture,
    interview as interviewFixture,
} from "@tests/fixtures/builders/hiring-data.builder"
import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Between, In, IsNull, LessThan } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityRowBuilder } from "@tests/fixtures/builders/entity-row.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { HiringDataService } from "./hiring-data.service"
import {
    HiringAvailabilityEntity,
    HiringCandidateEntity,
    HiringInterviewEntity,
    HiringJobEntity,
    HiringOfferEntity,
} from "./persistence/entities"

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
    answers: [],
    availability: "Monday morning",
    score: null,
    scoreLabel: null,
    scoreReasons: [],
    scoreSummary: null,
    screenedAt: null,
    stage: "rejected",
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

const availabilityRow = entityRowBuilder<HiringAvailabilityEntity>({
    id: "window-1",
    workspaceId: "ws-1",
    memberUserId: "user-1",
    weekday: 1,
    startMin: 480,
    endMin: 720,
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [HiringDataService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(HiringDataService)
}

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
        const em = mockEntityManager()
        const [membersRead] = queueQueryBuilders(em, [
            {
                getRawMany: [
                    { user_id: "owner-1", display_name: "Owner", is_owner: true },
                    { user_id: "user-1", display_name: "Blair", is_owner: false },
                ],
            },
        ])
        const service = await build(em)

        await expect(service.interviewers("ws-1")).resolves.toEqual([
            { userId: "owner-1", name: "Owner", isOwner: true },
            { userId: "user-1", name: "Blair", isOwner: false },
        ])
        expect(membersRead?.callsOf("where")).toEqual([["member.workspaceId = :workspaceId", { workspaceId: "ws-1" }]])
        expect(membersRead?.callsOf("andWhere")).toEqual([["member.status = :status", { status: "active" }]])
        expect(membersRead?.callsOf("orderBy")).toEqual([["is_owner", "DESC"]])
        expect(membersRead?.callsOf("addOrderBy")).toEqual([["member.createdAt", "ASC"]])
        expect(membersRead?.callsOf("limit")).toEqual([[20]])
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
