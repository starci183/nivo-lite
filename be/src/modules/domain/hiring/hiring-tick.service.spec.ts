import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OfficeLog } from "@modules/domain/module-ops"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { HiringCandidatesService } from "./hiring-candidates.service"
import { HiringDataService } from "./hiring-data.service"
import { HiringInterviewsService } from "./hiring-interviews.service"
import { HiringTextService } from "./hiring-text.service"
import { HiringTickService } from "./hiring-tick.service"
import type { InterviewRecord } from "./hiring.contracts"
import { HiringLogEvent } from "./hiring.log-events"

const EXPIRE_OFFERS = 'SELECT * FROM "public"."hiring_offers_expire"($1, $2)'
const EXPIRE_JOBS = 'SELECT * FROM "public"."hiring_jobs_expire"($1)'
const LOG_RETENTION = 'SELECT * FROM "public"."hiring_retention_log_add"($1, $2, $3, $4)'

/** What the tick reads of the settings of a workspace. */
interface TickWorkspace {
    readonly workspaceId: string
    readonly retentionDays: number
    readonly remindInterview: boolean
}

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const settingsOf = builder<TickWorkspace>({
    workspaceId: "ws-1",
    retentionDays: 30,
    remindInterview: true,
})

const interviewOf = builder<InterviewRecord>({
    id: "interview-1",
    workspaceId: "ws-1",
    candidateId: "candidate-1",
    jobId: "job-1",
    interviewerUserId: "manager-1",
    interviewerName: "Manager",
    mode: "in_person",
    location: "Cafe",
    durationMin: 30,
    proposedSlots: [],
    slotStart: "2026-10-13T08:00:00.000Z",
    slotEnd: "2026-10-13T08:30:00.000Z",
    status: "confirmed",
    token: "token-1",
    workItemId: "work-1",
    note: "",
})

const nothing = { reminders: 0, offersExpired: 0, jobsClosed: 0, deletedCandidates: 0, deletedFiles: 0 }

const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const clock = new FakeClock("2026-10-12T08:00:00.000Z")
    const logger = mock<Logger>()
    const office = mock<OfficeLog>()
    office.workspaceName.mockResolvedValue("Cafe")
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const words = mock<HiringTextService>()
    words.text.mockImplementation((key, params) => catalog.get(key, params ?? {}, "vi"))
    const data = mock<HiringDataService>()
    data.tickWorkspace.mockResolvedValue(settingsOf())
    data.dueReminders.mockResolvedValue([])
    data.liveJobIds.mockResolvedValue([])
    data.retentionDue.mockResolvedValue([])
    const candidates = mock<HiringCandidatesService>()
    candidates.closeJobIfFilled.mockResolvedValue(false)
    candidates.deleteAll.mockResolvedValue({ candidates: 0, files: 0 })
    const interviews = mock<HiringInterviewsService>()
    interviews.remind.mockResolvedValue(false)
    const moduleRef = await Test.createTestingModule({
        providers: [
            HiringTickService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
            { provide: OfficeLog, useValue: office },
            { provide: HiringDataService, useValue: data },
            { provide: HiringTextService, useValue: words },
            { provide: HiringCandidatesService, useValue: candidates },
            { provide: HiringInterviewsService, useValue: interviews },
        ],
    }).compile()
    return {
        service: moduleRef.get(HiringTickService),
        clock,
        logger,
        office,
        catalog,
        words,
        data,
        candidates,
        interviews,
    }
}

describe("HiringTickService", () => {
    it("ignores foreign jobs and runs the workspace supplied by a hiring payload", async () => {
        const em = mockEntityManager()
        const { service, data } = await build(em)
        data.tickWorkspace.mockResolvedValue(undefined)

        await expect(service.runJob({})).resolves.toBeUndefined()
        await expect(service.runJob({ workspaceId: 12 })).resolves.toBeUndefined()
        expect(data.tickWorkspace).not.toHaveBeenCalled()

        await expect(service.runJob({ workspaceId: "ws-1", extra: "allowed" })).resolves.toBeUndefined()

        expect(data.tickWorkspace.mock.calls).toEqual([["ws-1"]])
        expect(em.query).not.toHaveBeenCalled()
    })

    it("returns zero counts when the workspace does not use hiring", async () => {
        const em = mockEntityManager()
        const { service, data, office, candidates, interviews, logger } = await build(em)
        data.tickWorkspace.mockResolvedValue(undefined)

        await expect(service.run("ws-1")).resolves.toEqual(nothing)

        expect(data.tickWorkspace.mock.calls).toEqual([["ws-1"]])
        expect(data.dueReminders).not.toHaveBeenCalled()
        expect(data.liveJobIds).not.toHaveBeenCalled()
        expect(data.retentionDue).not.toHaveBeenCalled()
        expect(office.workspaceName).not.toHaveBeenCalled()
        expect(candidates.deleteAll).not.toHaveBeenCalled()
        expect(interviews.remind).not.toHaveBeenCalled()
        expect(em.query).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("skips disabled reminders and treats missing expiration rows and empty retention as zero", async () => {
        const em = mockEntityManager({
            query: [
                [EXPIRE_OFFERS, []],
                [EXPIRE_JOBS, []],
            ],
        })
        const { service, data, office, candidates, interviews, catalog, logger } = await build(em)
        data.tickWorkspace.mockResolvedValue(settingsOf({ retentionDays: 10, remindInterview: false }))

        await expect(service.run("ws-1")).resolves.toEqual(nothing)

        expect(data.dueReminders).not.toHaveBeenCalled()
        expect(office.workspaceName).not.toHaveBeenCalled()
        expect(interviews.remind).not.toHaveBeenCalled()
        expect(data.liveJobIds.mock.calls).toEqual([["ws-1"]])
        expect(data.retentionDue.mock.calls).toEqual([["ws-1", new Date("2026-10-02T08:00:00.000Z")]])
        expect(candidates.deleteAll).not.toHaveBeenCalled()
        expect(candidates.closeJobIfFilled).not.toHaveBeenCalled()
        expect(office.postOffice).not.toHaveBeenCalled()
        expect(em.query.mock.calls).toEqual([
            [EXPIRE_OFFERS, ["ws-1", "hiring.event.offerExpired{}"]],
            [EXPIRE_JOBS, ["ws-1"]],
        ])
        expect(catalog.get.mock.calls).toEqual([["hiring.event.offerExpired", {}, "vi"]])
        expect(logger.error).not.toHaveBeenCalled()
    })
})

describe("HiringTickService", () => {
    it("counts sent reminders, expired offers, closed jobs and deleted candidates and files", async () => {
        const em = mockEntityManager({
            query: [
                [EXPIRE_OFFERS, [{ hiring_offers_expire: ["offer-1", "offer-2"] }]],
                [EXPIRE_JOBS, [{ hiring_jobs_expire: ["Barista", "Cashier"] }]],
                [LOG_RETENTION, []],
            ],
        })
        const { service, data, office, candidates, interviews, catalog, logger } = await build(em)
        const first = interviewOf()
        const second = interviewOf({ id: "interview-2", candidateId: "candidate-2" })
        const third = interviewOf({ id: "interview-3", candidateId: "candidate-3" })
        data.dueReminders.mockResolvedValue([first, second, third])
        interviews.remind.mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
        data.liveJobIds.mockResolvedValue(["job-1", "job-2"])
        candidates.closeJobIfFilled.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
        data.retentionDue.mockResolvedValue(["candidate-4", "candidate-5"])
        candidates.deleteAll.mockResolvedValue({ candidates: 2, files: 1 })

        await expect(service.run("ws-1")).resolves.toEqual({
            reminders: 2,
            offersExpired: 2,
            jobsClosed: 3,
            deletedCandidates: 2,
            deletedFiles: 1,
        })

        expect(data.dueReminders.mock.calls).toEqual([
            ["ws-1", new Date("2026-10-12T08:00:00.000Z"), new Date("2026-10-13T08:00:00.000Z")],
        ])
        expect(office.workspaceName.mock.calls).toEqual([["ws-1"]])
        expect(interviews.remind.mock.calls).toEqual([
            [first, "Cafe"],
            [second, "Cafe"],
            [third, "Cafe"],
        ])
        expect(data.liveJobIds.mock.calls).toEqual([["ws-1"]])
        expect(candidates.closeJobIfFilled.mock.calls).toEqual([
            ["ws-1", "job-1"],
            ["ws-1", "job-2"],
        ])
        expect(data.retentionDue.mock.calls).toEqual([["ws-1", new Date("2026-09-12T08:00:00.000Z")]])
        expect(candidates.deleteAll.mock.calls).toEqual([["ws-1", ["candidate-4", "candidate-5"]]])
        expect(office.postOffice.mock.calls).toEqual([
            ["ws-1", `hiring.office.jobExpired{"title":"Barista"}`],
            ["ws-1", `hiring.office.jobExpired{"title":"Cashier"}`],
        ])
        expect(em.query.mock.calls).toEqual([
            [EXPIRE_OFFERS, ["ws-1", "hiring.event.offerExpired{}"]],
            [EXPIRE_JOBS, ["ws-1"]],
            [LOG_RETENTION, ["ws-1", 2, 1, 30]],
        ])
        expect(catalog.get.mock.calls).toEqual([
            ["hiring.event.offerExpired", {}, "vi"],
            ["hiring.office.jobExpired", { title: "Barista" }, "vi"],
            ["hiring.office.jobExpired", { title: "Cashier" }, "vi"],
        ])
        expect(logger.error).not.toHaveBeenCalled()
    })
})

describe("HiringTickService", () => {
    it("handles enabled reminders with no due interviews and present empty expiration rows", async () => {
        const em = mockEntityManager({
            query: [
                [EXPIRE_OFFERS, [{ hiring_offers_expire: [] }]],
                [EXPIRE_JOBS, [{ hiring_jobs_expire: [] }]],
            ],
        })
        const { service, data, office, interviews, candidates, logger } = await build(em)

        await expect(service.run("ws-1")).resolves.toEqual(nothing)

        expect(data.dueReminders.mock.calls).toEqual([
            ["ws-1", new Date("2026-10-12T08:00:00.000Z"), new Date("2026-10-13T08:00:00.000Z")],
        ])
        expect(office.workspaceName.mock.calls).toEqual([["ws-1"]])
        expect(interviews.remind).not.toHaveBeenCalled()
        expect(candidates.deleteAll).not.toHaveBeenCalled()
        expect(office.postOffice).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs every failing step and returns each fallback without aborting the other steps", async () => {
        const em = mockEntityManager({ query: [[EXPIRE_JOBS, []]] })
        const { service, data, logger, candidates } = await build(em)
        const remindersFailure = new Error("reminders-failed")
        const offersFailure = new Error("offers-failed")
        const jobsFailure = new Error("jobs-failed")
        const retentionFailure = new Error("retention-failed")
        data.dueReminders.mockRejectedValue(remindersFailure)
        em.query.mockRejectedValueOnce(offersFailure)
        data.liveJobIds.mockRejectedValue(jobsFailure)
        data.retentionDue.mockRejectedValue(retentionFailure)

        await expect(service.run("ws-1")).resolves.toEqual(nothing)

        expect(
            [...logger.error.mock.calls].sort((left, right) =>
                JSON.stringify(left).localeCompare(JSON.stringify(right)),
            ),
        ).toEqual([
            [HiringLogEvent.TickFailed, { workspaceId: "ws-1", step: "jobs", cause: jobsFailure }],
            [HiringLogEvent.TickFailed, { workspaceId: "ws-1", step: "offers", cause: offersFailure }],
            [HiringLogEvent.TickFailed, { workspaceId: "ws-1", step: "reminders", cause: remindersFailure }],
            [HiringLogEvent.TickFailed, { workspaceId: "ws-1", step: "retention", cause: retentionFailure }],
        ])
        expect(data.liveJobIds.mock.calls).toEqual([["ws-1"]])
        expect(data.retentionDue.mock.calls).toEqual([["ws-1", new Date("2026-09-12T08:00:00.000Z")]])
        expect(candidates.deleteAll).not.toHaveBeenCalled()
        expect(em.query.mock.calls).toEqual([
            [EXPIRE_OFFERS, ["ws-1", "hiring.event.offerExpired{}"]],
            [EXPIRE_JOBS, ["ws-1"]],
        ])
    })
})

describe("HiringTickService", () => {
    it("preserves successful counts when reminding fails", async () => {
        const em = mockEntityManager({
            query: [
                [EXPIRE_OFFERS, [{ hiring_offers_expire: ["offer-1"] }]],
                [EXPIRE_JOBS, [{ hiring_jobs_expire: ["Barista"] }]],
                [LOG_RETENTION, []],
            ],
        })
        const { service, data, interviews, candidates, logger } = await build(em)
        const cause = new Error("delivery-failed")
        data.dueReminders.mockResolvedValue([interviewOf()])
        interviews.remind.mockRejectedValue(cause)
        data.retentionDue.mockResolvedValue(["candidate-1"])
        candidates.deleteAll.mockResolvedValue({ candidates: 1, files: 3 })

        await expect(service.run("ws-1")).resolves.toEqual({
            reminders: 0,
            offersExpired: 1,
            jobsClosed: 1,
            deletedCandidates: 1,
            deletedFiles: 3,
        })

        expect(logger.error.mock.calls).toEqual([
            [HiringLogEvent.TickFailed, { workspaceId: "ws-1", step: "reminders", cause }],
        ])
        expect(em.query.mock.calls).toEqual([
            [EXPIRE_OFFERS, ["ws-1", "hiring.event.offerExpired{}"]],
            [EXPIRE_JOBS, ["ws-1"]],
            [LOG_RETENTION, ["ws-1", 1, 3, 30]],
        ])
    })
})
