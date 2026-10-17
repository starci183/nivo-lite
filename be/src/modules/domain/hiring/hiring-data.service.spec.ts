import type { HiringSettings, JobRecord, CandidateRecord, InterviewRecord, OfferRecord } from "./hiring.contracts"
import {
    settingsRow,
    settings as settingsFixture,
    jobRow,
    job as jobFixture,
    candidateRow,
    candidate as candidateFixture,
    interviewRow,
    interview as interviewFixture,
    offerRow,
    offer as offerFixture,
} from "@tests/fixtures/builders/hiring-data.builder"
import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { HiringDataService } from "./hiring-data.service"
import {
    COUNT_ASKS,
    SELECT_ACTIVE_OFFER,
    SELECT_AVAILABILITY,
    SELECT_BUSY,
    SELECT_CANDIDATE,
    SELECT_CANDIDATE_HEAD,
    SELECT_CHAT_JOBS,
    SELECT_CONVERSATION_CHANNEL,
    SELECT_DUE_REMINDERS,
    SELECT_INTERVIEW_BY_TOKEN,
    SELECT_INTERVIEWERS,
    SELECT_JOB,
    SELECT_JOB_BY_SLUG,
    SELECT_JOB_HEAD,
    SELECT_LIVE_JOBS,
    SELECT_MEMBER_NAME,
    SELECT_OFFER,
    SELECT_OFFER_BY_TOKEN,
    SELECT_OPEN_INTERVIEW,
    SELECT_RETENTION_DUE,
    SELECT_SETTINGS,
    SELECT_SETTINGS_BY_SLUG,
    SELECT_TICK_WORKSPACE,
} from "./persistence/hiring.sql"

const settings: HiringSettings = settingsFixture
const job: JobRecord = jobFixture
const candidate: CandidateRecord = candidateFixture
const interview: InterviewRecord = interviewFixture
const offer: OfferRecord = offerFixture

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [HiringDataService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(HiringDataService)
}

describe("HiringDataService", () => {
    it.each([true, false])("reads mapped records with a row present: %s", async (present) => {
        const em = mockEntityManager({
            query: [
                [SELECT_SETTINGS, present ? [settingsRow, { ...settingsRow, public_slug: "ignored" }] : []],
                [SELECT_SETTINGS_BY_SLUG, present ? [settingsRow] : []],
                [SELECT_JOB, present ? [jobRow, { ...jobRow, id: "ignored" }] : []],
                [SELECT_JOB_BY_SLUG, present ? [jobRow] : []],
                [SELECT_CANDIDATE, present ? [candidateRow, { ...candidateRow, id: "ignored" }] : []],
                [SELECT_INTERVIEW_BY_TOKEN, present ? [interviewRow, { ...interviewRow, id: "ignored" }] : []],
                [SELECT_OFFER, present ? [offerRow, { ...offerRow, id: "ignored" }] : []],
                [SELECT_OFFER_BY_TOKEN, present ? [offerRow] : []],
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
        expect(em.query.mock.calls).toEqual([
            [SELECT_SETTINGS, ["ws-1"]],
            [SELECT_SETTINGS_BY_SLUG, ["shop"]],
            [SELECT_JOB, ["ws-1", "job-1"]],
            [SELECT_JOB_BY_SLUG, ["ws-1", "barista"]],
            [SELECT_CANDIDATE, ["ws-1", "candidate-1"]],
            [SELECT_INTERVIEW_BY_TOKEN, ["interview-token"]],
            [SELECT_OFFER, ["ws-1", "offer-1"]],
            [SELECT_OFFER_BY_TOKEN, ["offer-token"]],
        ])
    })
})

describe("HiringDataService", () => {
    it("returns first raw workspace, candidate head, job head and member rows", async () => {
        const workspace = { workspace_id: "ws-1", retention_days: 90, remind_interview: true }
        const candidateHead = { id: "candidate-1", name: "Alex" }
        const jobHead = { title: "Barista", location: "Main shop", position: "Coffee maker" }
        const member = { user_id: "user-1", display_name: "Blair" }
        const em = mockEntityManager({
            query: [
                [SELECT_TICK_WORKSPACE, [workspace, { ...workspace, workspace_id: "ignored" }]],
                [SELECT_CANDIDATE_HEAD, [candidateHead, { ...candidateHead, name: "ignored" }]],
                [SELECT_JOB_HEAD, [jobHead, { ...jobHead, title: "ignored" }]],
                [SELECT_MEMBER_NAME, [member, { ...member, display_name: "ignored" }]],
                [SELECT_TICK_WORKSPACE, []],
                [SELECT_CANDIDATE_HEAD, []],
                [SELECT_JOB_HEAD, []],
                [SELECT_MEMBER_NAME, []],
            ],
        })
        const service = await build(em)

        await expect(service.tickWorkspace("ws-1")).resolves.toEqual(workspace)
        await expect(service.candidateHead("candidate-1")).resolves.toEqual(candidateHead)
        await expect(service.jobHead("job-1")).resolves.toEqual(jobHead)
        await expect(service.memberName("ws-1", "user-1")).resolves.toEqual(member)
        await expect(service.tickWorkspace("ws-2")).resolves.toBeUndefined()
        await expect(service.candidateHead("candidate-2")).resolves.toBeUndefined()
        await expect(service.jobHead("job-2")).resolves.toBeUndefined()
        await expect(service.memberName("ws-2", "user-2")).resolves.toBeUndefined()
        expect(em.query.mock.calls).toEqual([
            [SELECT_TICK_WORKSPACE, ["ws-1"]],
            [SELECT_CANDIDATE_HEAD, ["candidate-1"]],
            [SELECT_JOB_HEAD, ["job-1"]],
            [SELECT_MEMBER_NAME, ["ws-1", "user-1"]],
            [SELECT_TICK_WORKSPACE, ["ws-2"]],
            [SELECT_CANDIDATE_HEAD, ["candidate-2"]],
            [SELECT_JOB_HEAD, ["job-2"]],
            [SELECT_MEMBER_NAME, ["ws-2", "user-2"]],
        ])
    })
})

describe("HiringDataService", () => {
    it("combines candidate and job heads only when both exist", async () => {
        const candidateHead = { id: "candidate-1", name: "Alex" }
        const jobHead = { title: "Barista", location: "Main shop", position: "Coffee maker" }
        const em = mockEntityManager({
            query: [
                [SELECT_CANDIDATE_HEAD, [candidateHead]],
                [SELECT_JOB_HEAD, [jobHead]],
                [SELECT_CANDIDATE_HEAD, []],
                [SELECT_JOB_HEAD, [jobHead]],
                [SELECT_CANDIDATE_HEAD, [candidateHead]],
                [SELECT_JOB_HEAD, []],
                [SELECT_CANDIDATE_HEAD, []],
                [SELECT_JOB_HEAD, []],
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
        expect(em.query.mock.calls).toEqual([
            [SELECT_CANDIDATE_HEAD, ["candidate-1"]],
            [SELECT_JOB_HEAD, ["job-1"]],
            [SELECT_CANDIDATE_HEAD, ["candidate-2"]],
            [SELECT_JOB_HEAD, ["job-1"]],
            [SELECT_CANDIDATE_HEAD, ["candidate-1"]],
            [SELECT_JOB_HEAD, ["job-2"]],
            [SELECT_CANDIDATE_HEAD, ["candidate-2"]],
            [SELECT_JOB_HEAD, ["job-2"]],
        ])
    })
})

describe("HiringDataService", () => {
    it("maps chat jobs, reminder interviews, availability and interviewers", async () => {
        const from = new Date("2026-10-14T00:00:00.000Z")
        const until = new Date("2026-10-14T02:00:00.000Z")
        const em = mockEntityManager({
            query: [
                [SELECT_CHAT_JOBS, [jobRow, { ...jobRow, id: "job-2" }]],
                [SELECT_DUE_REMINDERS, [interviewRow, { ...interviewRow, id: "interview-2" }]],
                [
                    SELECT_AVAILABILITY,
                    [
                        { weekday: 1, start_min: 480, end_min: 720 },
                        { weekday: 2, start_min: 600, end_min: 900 },
                    ],
                ],
                [
                    SELECT_INTERVIEWERS,
                    [
                        { user_id: "owner-1", display_name: "Owner", is_owner: true },
                        { user_id: "user-1", display_name: "Blair", is_owner: false },
                    ],
                ],
            ],
        })
        const service = await build(em)

        await expect(service.chatJobs("ws-1")).resolves.toEqual([job, { ...job, id: "job-2" }])
        await expect(service.dueReminders("ws-1", from, until)).resolves.toEqual([
            interview,
            { ...interview, id: "interview-2" },
        ])
        await expect(service.availability("ws-1", "user-1")).resolves.toEqual([
            { weekday: 1, startMin: 480, endMin: 720 },
            { weekday: 2, startMin: 600, endMin: 900 },
        ])
        await expect(service.interviewers("ws-1")).resolves.toEqual([
            { userId: "owner-1", name: "Owner", isOwner: true },
            { userId: "user-1", name: "Blair", isOwner: false },
        ])
        expect(em.query.mock.calls).toEqual([
            [SELECT_CHAT_JOBS, ["ws-1"]],
            [SELECT_DUE_REMINDERS, ["ws-1", "2026-10-14T00:00:00.000Z", "2026-10-14T02:00:00.000Z"]],
            [SELECT_AVAILABILITY, ["ws-1", "user-1"]],
            [SELECT_INTERVIEWERS, ["ws-1"]],
        ])
    })

    it("filters null live and retention ids and serializes the retention cutoff", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_LIVE_JOBS, [{ id: "job-1" }, { id: null }, { id: "job-2" }]],
                [SELECT_RETENTION_DUE, [{ id: null }, { id: "candidate-1" }, { id: "candidate-2" }]],
            ],
        })
        const service = await build(em)

        await expect(service.liveJobIds("ws-1")).resolves.toEqual(["job-1", "job-2"])
        await expect(service.retentionDue("ws-1", new Date("2026-07-15T00:00:00.000Z"))).resolves.toEqual([
            "candidate-1",
            "candidate-2",
        ])
        expect(em.query.mock.calls).toEqual([
            [SELECT_LIVE_JOBS, ["ws-1"]],
            [SELECT_RETENTION_DUE, ["ws-1", "2026-07-15T00:00:00.000Z"]],
        ])
    })
})

describe("HiringDataService", () => {
    it("reports whether open interviews and active offers have a row", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_OPEN_INTERVIEW, [{ id: "interview-1" }]],
                [SELECT_OPEN_INTERVIEW, []],
                [SELECT_ACTIVE_OFFER, [{ id: "offer-1" }]],
                [SELECT_ACTIVE_OFFER, []],
            ],
        })
        const service = await build(em)

        await expect(service.hasOpenInterview("candidate-1")).resolves.toBe(true)
        await expect(service.hasOpenInterview("candidate-2")).resolves.toBe(false)
        await expect(service.hasActiveOffer("candidate-1")).resolves.toBe(true)
        await expect(service.hasActiveOffer("candidate-2")).resolves.toBe(false)
        expect(em.query.mock.calls).toEqual([
            [SELECT_OPEN_INTERVIEW, ["candidate-1"]],
            [SELECT_OPEN_INTERVIEW, ["candidate-2"]],
            [SELECT_ACTIVE_OFFER, ["candidate-1"]],
            [SELECT_ACTIVE_OFFER, ["candidate-2"]],
        ])
    })

    it("uses confirmed bounds and falls back to proposed slots for every incomplete bound", async () => {
        const first = { start: "2026-10-14T01:00:00.000Z", end: "2026-10-14T01:30:00.000Z" }
        const second = { start: "2026-10-14T02:00:00.000Z", end: "2026-10-14T02:30:00.000Z" }
        const third = { start: "2026-10-14T03:00:00.000Z", end: "2026-10-14T03:30:00.000Z" }
        const fourth = { start: "2026-10-14T04:00:00.000Z", end: "2026-10-14T04:30:00.000Z" }
        const confirmed = {
            status: "confirmed",
            slot_start: new Date(first.start),
            slot_end: first.end,
            proposed_slots: [{ start: "ignored", end: "ignored" }],
        }
        const em = mockEntityManager({
            query: [
                [
                    SELECT_BUSY,
                    [
                        confirmed,
                        { ...confirmed, status: "proposed", proposed_slots: [second] },
                        { ...confirmed, slot_start: null, proposed_slots: [third] },
                        { ...confirmed, slot_end: null, proposed_slots: [fourth] },
                        { status: "proposed", slot_start: null, slot_end: null, proposed_slots: null },
                    ],
                ],
            ],
        })
        const service = await build(em)

        await expect(service.busy("ws-1", "user-1")).resolves.toEqual([first, second, third, fourth])
        expect(em.query.mock.calls).toEqual([[SELECT_BUSY, ["ws-1", "user-1"]]])
    })
})

describe("HiringDataService", () => {
    it("reads channels with defaults for absent and null rows", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_CONVERSATION_CHANNEL, [{ channel: "telegram" }]],
                [SELECT_CONVERSATION_CHANNEL, [{ channel: null }]],
                [SELECT_CONVERSATION_CHANNEL, []],
            ],
        })
        const service = await build(em)

        await expect(service.conversationChannel("conversation-1")).resolves.toBe("telegram")
        await expect(service.conversationChannel("conversation-2")).resolves.toBeNull()
        await expect(service.conversationChannel("conversation-3")).resolves.toBeNull()
        expect(em.query.mock.calls).toEqual([
            [SELECT_CONVERSATION_CHANNEL, ["conversation-1"]],
            [SELECT_CONVERSATION_CHANNEL, ["conversation-2"]],
            [SELECT_CONVERSATION_CHANNEL, ["conversation-3"]],
        ])
    })

    it("converts ask counts to numbers and adds the prefix wildcard", async () => {
        const em = mockEntityManager({
            query: [
                [COUNT_ASKS, [{ count: "3" }]],
                [COUNT_ASKS, [{ count: 2 }]],
                [COUNT_ASKS, []],
            ],
        })
        const service = await build(em)

        await expect(service.askAttempts("ws-1", "send_offer", "offer:offer-1:")).resolves.toBe(3)
        await expect(service.askAttempts("ws-1", "invite_interview", "interview:candidate-1:")).resolves.toBe(2)
        await expect(service.askAttempts("ws-2", "send_offer", "offer:offer-2:")).resolves.toBe(0)
        expect(em.query.mock.calls).toEqual([
            [COUNT_ASKS, ["ws-1", "send_offer", "offer:offer-1:%"]],
            [COUNT_ASKS, ["ws-1", "invite_interview", "interview:candidate-1:%"]],
            [COUNT_ASKS, ["ws-2", "send_offer", "offer:offer-2:%"]],
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
