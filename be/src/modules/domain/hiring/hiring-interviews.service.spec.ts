import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ApprovalGate, OfficeLog } from "@modules/domain/module-ops"
import type { PerformContext } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { MessageCatalog } from "@modules/platform/i18n"
import { HiringErrorCode } from "./errors/hiring.error"
import type { CandidateRecord, InterviewRecord, Slot } from "./hiring.contracts"
import type { RequestInterviewParams, SetInterviewStatusParams } from "./hiring-operations.contracts"
import { HiringCandidatesService } from "./hiring-candidates.service"
import { HiringDataService } from "./hiring-data.service"
import { HiringInterviewsService } from "./hiring-interviews.service"
import { HiringLinksService } from "./hiring-links.service"
import { HiringNotifyService } from "./hiring-notify.service"
import { HiringTextService } from "./hiring-text.service"
import {
    CLAIM_REMINDER,
    CONFIRM_INTERVIEW,
    CREATE_INTERVIEW,
    LOG_EVENT,
    NONE_FIT_INTERVIEW,
    SAVE_AVAILABILITY,
    SET_INTERVIEW_STATUS,
} from "./persistence/hiring.sql"

const TOKEN = "0123456789abcdef0123456789abcdef"
type ApprovalRequest = Parameters<ApprovalGate["request"]>[0]
const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`
const candidateOf = builder<CandidateRecord>({
    id: "candidate-1",
    workspaceId: "ws-1",
    jobId: "job-1",
    name: "Alice",
    phone: "0901234567",
    email: "alice@example.com",
    source: "page",
    conversationId: null,
    cvPath: null,
    cvName: null,
    cvMime: null,
    answers: [],
    availability: "Monday",
    stage: "shortlisted",
    staffId: null,
})
const slot: Slot = { start: "2026-10-12T02:00:00.000Z", end: "2026-10-12T02:30:00.000Z" }
const interviewOf = builder<InterviewRecord>({
    id: "interview-1",
    workspaceId: "ws-1",
    candidateId: "candidate-1",
    jobId: "job-1",
    interviewerUserId: "interviewer-1",
    interviewerName: "Bob",
    mode: "in_person",
    location: "Main Street",
    durationMin: 30,
    proposedSlots: [slot],
    slotStart: slot.start,
    slotEnd: slot.end,
    status: "proposed",
    token: TOKEN,
    workItemId: "work-1",
    note: "Candidate note",
})
const requestOf = builder<RequestInterviewParams>({
    candidateId: "candidate-1",
    mode: "in_person",
    location: " Main Street ",
    durationMin: 30,
})
const statusOf = builder<SetInterviewStatusParams>({ id: "interview-1", status: "done" })
const fields = {
    candidate_id: "candidate-1",
    interviewer_user_id: "interviewer-1",
    interviewer_name: "Bob",
    mode: "online",
    location: "https://meeting.example.com",
    duration_min: 30,
}
const contextOf = builder<PerformContext>({
    workspaceId: "ws-1",
    workItemId: "work-1",
    actor: "Manager",
    draft: null,
    fields,
})
const gateOf = builder<ApprovalRequest>({
    workspaceId: "ws-1",
    actor: "Manager",
    action: "schedule_interview",
    subjectType: "candidate",
    subjectId: "candidate-1",
    dedupeKey: "schedule_interview:candidate-1:3",
    summary: text("hiring.interview.summary", { name: "Alice" }),
    fields,
})
const roleCall = ["user-1", "ws-1", ["owner", "manager"]]
const head = { title: "Barista", position: "Barista", location: "Main Street" }
const when = `when:${slot.start}`
const confirmArgs = [TOKEN, slot.start, slot.end, text("hiring.event.interviewConfirmed", { when })]
const defaultSlots = [
    slot,
    { start: "2026-10-13T02:00:00.000Z", end: "2026-10-13T02:30:00.000Z" },
    { start: "2026-10-14T02:00:00.000Z", end: "2026-10-14T02:30:00.000Z" },
]
const declaredSlots = [
    slot,
    { start: "2026-10-19T02:00:00.000Z", end: "2026-10-19T02:30:00.000Z" },
    { start: "2026-10-26T02:00:00.000Z", end: "2026-10-26T02:30:00.000Z" },
]
const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const words = mock<HiringTextService>()
    words.text.mockImplementation((key, params) => catalog.get(key, params ?? {}, "vi"))
    words.when.mockImplementation((instant) => `when:${String(instant)}`)
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "manager",
        staffId: null,
        displayName: "Manager",
        status: "active",
    })
    const gate = mock<ApprovalGate>()
    gate.request.mockResolvedValue({ status: "waiting_decision", workItemId: "work-1" })
    const office = mock<OfficeLog>()
    office.workspaceName.mockResolvedValue("Coffee Shop")
    const data = mock<HiringDataService>()
    data.hasOpenInterview.mockResolvedValue(false)
    data.memberName.mockResolvedValue({ user_id: "interviewer-1", display_name: "Bob" })
    data.interviewers.mockResolvedValue([{ userId: "interviewer-1", name: "Bob", isOwner: true }])
    data.askAttempts.mockResolvedValue(2)
    data.jobHead.mockResolvedValue(head)
    data.availability.mockResolvedValue([{ weekday: 1, startMin: 540, endMin: 570 }])
    data.busy.mockResolvedValue([])
    data.newToken.mockResolvedValue(TOKEN)
    data.interviewByToken.mockResolvedValue(interviewOf())
    data.heads.mockResolvedValue({ candidateName: "Alice", jobTitle: "Barista", jobLocation: "Main Street" })
    data.candidateHead.mockResolvedValue({ id: "candidate-1", name: "Alice" })
    data.candidate.mockResolvedValue(candidateOf())
    const links = mock<HiringLinksService>()
    links.interview.mockImplementation((token) => `interview:${token}`)
    const notify = mock<HiringNotifyService>()
    notify.toCandidate.mockResolvedValue({ via: "email", delivered: true, note: "delivery-note" })
    const candidates = mock<HiringCandidatesService>()
    candidates.requireOpenCandidate.mockResolvedValue(candidateOf())
    candidates.requireCandidate.mockResolvedValue(candidateOf())
    const moduleRef = await Test.createTestingModule({
        providers: [
            HiringInterviewsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T00:00:00.000Z") },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ApprovalGate, useValue: gate },
            { provide: OfficeLog, useValue: office },
            { provide: HiringDataService, useValue: data },
            { provide: HiringTextService, useValue: words },
            { provide: HiringLinksService, useValue: links },
            { provide: HiringNotifyService, useValue: notify },
            { provide: HiringCandidatesService, useValue: candidates },
        ],
    }).compile()
    return { service: moduleRef.get(HiringInterviewsService), members, gate, office, data, links, notify, candidates }
}

describe("HiringInterviewsService", () => {
    it.each([
        { request: requestOf({ durationMin: 0 }), expected: 30 },
        { request: requestOf({ durationMin: -1 }), expected: 15 },
        { request: requestOf({ durationMin: 181 }), expected: 180 },
        { request: requestOf({ durationMin: 45 }), expected: 45 },
        {
            request: requestOf({ interviewerUserId: "member-2", mode: "online", location: ` ${"x".repeat(301)} ` }),
            expected: 30,
        },
    ])("requests an interview with duration $request.durationMin", async ({ request, expected }) => {
        const { service, members, candidates, data, gate } = await build()
        await expect(service.request("user-1", "ws-1", request)).resolves.toEqual({
            status: "waiting_decision",
            summary: text("hiring.interview.asked", { name: "Alice" }),
            error: null,
        })
        const explicit = request.interviewerUserId !== undefined
        expect(members.require.mock.calls).toEqual([roleCall])
        expect(candidates.requireOpenCandidate.mock.calls).toEqual([["ws-1", "candidate-1"]])
        expect(data.hasOpenInterview.mock.calls).toEqual([["candidate-1"]])
        expect(data.interviewers.mock.calls).toEqual(explicit ? [] : [["ws-1"]])
        expect(data.memberName.mock.calls).toEqual(explicit ? [["ws-1", "member-2"]] : [])
        expect(data.askAttempts.mock.calls).toEqual([["ws-1", "schedule_interview", "schedule_interview:candidate-1:"]])
        const expectedFields = {
            candidate_id: "candidate-1",
            interviewer_user_id: explicit ? "member-2" : "interviewer-1",
            interviewer_name: "Bob",
            mode: request.mode,
            location: explicit ? "x".repeat(300) : "Main Street",
            duration_min: expected,
            contact: "alice@example.com",
        }
        expect(gate.request.mock.calls).toEqual([[gateOf({ fields: expectedFields })]])
    })

    it("refuses open interviews, nonmembers, missing interviewers and empty online links", async () => {
        const { service, data, gate } = await build()
        data.hasOpenInterview.mockResolvedValueOnce(true)
        data.memberName.mockResolvedValue(undefined)
        data.interviewers.mockResolvedValueOnce([])
        const failures = [
            { request: requestOf(), code: HiringErrorCode.InterviewOpen },
            { request: requestOf({ interviewerUserId: "missing" }), code: HiringErrorCode.InterviewerNotMember },
            { request: requestOf(), code: HiringErrorCode.InterviewerMissing },
            { request: requestOf({ mode: "online", location: "  " }), code: HiringErrorCode.OnlineLinkRequired },
        ]
        for (const { request, code } of failures) {
            await expect(service.request("user-1", "ws-1", request)).rejects.toMatchObject({ code })
        }
        expect(gate.request).not.toHaveBeenCalled()
    })

    it.each([
        { declared: true, jobPresent: true, location: fields.location, title: "Barista" },
        { declared: false, jobPresent: true, location: "Main Street", title: "Barista" },
        { declared: false, jobPresent: false, location: "", title: "" },
    ])("performs declared=$declared with job=$jobPresent", async ({ declared, jobPresent, location, title }) => {
        const em = mockEntityManager({ query: [CREATE_INTERVIEW, []] })
        const { service, data, notify, links, office } = await build(em)
        if (!declared) data.availability.mockResolvedValue([])
        if (!jobPresent) data.jobHead.mockResolvedValue(undefined)
        const note = declared ? "delivery-note" : "manual-note"
        notify.toCandidate.mockResolvedValue({ via: "manual", delivered: declared, note })
        const mode = declared ? "online" : "in_person"
        const slots = declared ? declaredSlots : defaultSlots
        const stored = {
            interviewerUserId: declared ? "interviewer-1" : null,
            interviewerName: declared ? "Bob" : "",
            mode,
            location,
            durationMin: 30,
            slots,
        }
        const event = text("hiring.event.interviewProposed", {
            count: 3,
            who: declared ? "Bob" : text("hiring.interview.someone"),
            fallback: declared ? "" : text("hiring.interview.defaultWindow"),
        })
        const expected = {
            summary: text("hiring.interview.proposed", { count: 3, name: "Alice", note }),
            evidence: "captured",
        }
        await expect(
            service.perform(
                contextOf({ fields: declared ? fields : { candidate_id: "candidate-1", duration_min: 0 } }),
            ),
        ).resolves.toEqual(declared ? expected : { ...expected, detail: `interview:${TOKEN}` })
        const interviewerId = declared ? "interviewer-1" : ""
        expect(data.availability.mock.calls).toEqual([["ws-1", interviewerId]])
        expect(data.busy.mock.calls).toEqual([["ws-1", interviewerId]])
        const args = ["ws-1", "candidate-1", "job-1", JSON.stringify(stored), TOKEN, "work-1", "Manager", event]
        expect(em.query.mock.calls).toEqual([[CREATE_INTERVIEW, args]])
        expect(links.interview.mock.calls).toEqual([[TOKEN]])
        expect(office.workspaceName.mock.calls).toEqual([["ws-1"]])
        const invite = text("hiring.interview.invite", {
            name: "Alice",
            title,
            shop: "Coffee Shop",
            where: text(`hiring.interview.${mode}`),
            place: location === "" ? "" : ` (${location})`,
            minutes: 30,
            slots: slots.map((item) => `- when:${item.start}`).join("\n"),
            link: `interview:${TOKEN}`,
        })
        expect(notify.toCandidate.mock.calls).toEqual([
            [
                candidateOf(),
                {
                    subject: text("hiring.interview.subject", { title }),
                    text: invite,
                    workItemId: "work-1",
                },
            ],
        ])
    })

    it("refuses a performance without free slots", async () => {
        const em = mockEntityManager()
        const { service, data, notify } = await build(em)
        data.availability.mockResolvedValue([{ weekday: 1, startMin: 540, endMin: 550 }])
        await expect(service.perform(contextOf())).rejects.toMatchObject({ code: HiringErrorCode.NoSlots })
        expect(em.query).not.toHaveBeenCalled()
        expect(notify.toCandidate).not.toHaveBeenCalled()
    })

    it("returns exact public fields and rejects invalid tokens or missing data", async () => {
        const { service, data, office } = await build()
        const expected = {
            status: "proposed",
            candidateName: "Alice",
            jobTitle: "Barista",
            shop: "Coffee Shop",
            mode: "in_person",
            location: "Main Street",
            durationMin: 30,
            interviewerName: "Bob",
            slotStart: slot.start,
            note: "Candidate note",
            proposedSlots: [slot],
        }
        await expect(service.publicView({ token: TOKEN })).resolves.toEqual(expected)
        expect(data.interviewByToken.mock.calls).toEqual([[TOKEN]])
        expect(data.heads.mock.calls).toEqual([["candidate-1", "job-1"]])
        expect(office.workspaceName.mock.calls).toEqual([["ws-1"]])
        const missing = { code: HiringErrorCode.PublicNotFound }
        await expect(service.publicView({ token: "bad" })).rejects.toMatchObject(missing)
        expect(data.interviewByToken.mock.calls).toEqual([[TOKEN]])
        data.interviewByToken.mockResolvedValueOnce(undefined)
        await expect(service.publicView({ token: TOKEN })).rejects.toMatchObject(missing)
        data.heads.mockResolvedValue(undefined)
        await expect(service.publicView({ token: TOKEN })).rejects.toMatchObject(missing)
    })

    it("leaves invalid, confirmed and closed responses unchanged", async () => {
        const { service, data } = await build()
        const invalid = { outcome: "invalid", slotStart: null }
        await expect(service.respond({ token: "bad" })).resolves.toEqual(invalid)
        expect(data.interviewByToken).not.toHaveBeenCalled()
        data.interviewByToken
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(interviewOf({ status: "confirmed" }))
            .mockResolvedValueOnce(interviewOf({ status: "done" }))
        await expect(service.respond({ token: TOKEN })).resolves.toEqual(invalid)
        const confirmed = { outcome: "already_confirmed", slotStart: slot.start }
        await expect(service.respond({ token: TOKEN })).resolves.toEqual(confirmed)
        await expect(service.respond({ token: TOKEN })).resolves.toEqual({ outcome: "closed", slotStart: null })
        expect(data.candidateHead).not.toHaveBeenCalled()
    })

    it("records no fitting slot with missing heads and rejects unoffered times", async () => {
        const em = mockEntityManager({ query: [NONE_FIT_INTERVIEW, [{ value: true }]] })
        const { service, data, office } = await build(em)
        data.candidateHead.mockResolvedValue(undefined)
        data.jobHead.mockResolvedValue(undefined)
        await expect(service.respond({ token: TOKEN })).resolves.toEqual({ outcome: "none_fit", slotStart: null })
        const args = [TOKEN, text("hiring.interview.noneFitNote"), text("hiring.event.noneFit")]
        expect(em.query.mock.calls).toEqual([[NONE_FIT_INTERVIEW, args]])
        expect(office.postOffice.mock.calls).toEqual([["ws-1", text("hiring.office.noneFit", { name: "", title: "" })]])
        const response = service.respond({ token: TOKEN, start: "2026-10-13T02:00:00.000Z" })
        await expect(response).resolves.toEqual({ outcome: "not_offered", slotStart: null })
        expect(em.query.mock.calls).toEqual([[NONE_FIT_INTERVIEW, args]])
    })

    it.each([
        { rows: [], name: "Bob", outcome: "stale" },
        { rows: [{ value: false }], name: "Bob", outcome: "stale" },
        { rows: [{ value: true }], name: "Bob", outcome: "confirmed" },
        { rows: [{ value: true }], name: "", outcome: "confirmed" },
    ])("responds $outcome with interviewer '$name'", async ({ rows, name, outcome }) => {
        const em = mockEntityManager({ query: [CONFIRM_INTERVIEW, rows] })
        const { service, data, office } = await build(em)
        data.interviewByToken.mockResolvedValue(interviewOf({ interviewerName: name }))
        const expected = { outcome, slotStart: outcome === "confirmed" ? slot.start : null }
        await expect(service.respond({ token: TOKEN, start: slot.start })).resolves.toEqual(expected)
        expect(em.query.mock.calls).toEqual([[CONFIRM_INTERVIEW, confirmArgs]])
        const line = text("hiring.office.interviewConfirmed", {
            name: "Alice",
            title: "Barista",
            when,
            who: name === "" ? "" : text("hiring.office.withWho", { who: "Bob" }),
        })
        expect(office.postOffice.mock.calls).toEqual(outcome === "confirmed" ? [["ws-1", line]] : [])
    })

    it.each([statusOf(), statusOf({ status: "cancelled" }), statusOf({ status: "no_show" })])(
        "sets $status",
        async (request) => {
            const em = mockEntityManager({ query: [SET_INTERVIEW_STATUS, [{ id: "interview-1" }]] })
            const { service, members } = await build(em)
            await service.setStatus("user-1", "ws-1", request)
            expect(members.require.mock.calls).toEqual([roleCall])
            const event = text(`hiring.event.interview_${request.status}`)
            const args = ["ws-1", "interview-1", request.status, "Manager", event]
            expect(em.query.mock.calls).toEqual([[SET_INTERVIEW_STATUS, args]])
        },
    )

    it.each([{ rows: [] }, { rows: [{ id: null }] }])("refuses missing status rows $rows", async ({ rows }) => {
        const em = mockEntityManager({ query: [SET_INTERVIEW_STATUS, rows] })
        const { service } = await build(em)
        await expect(service.setStatus("user-1", "ws-1", statusOf())).rejects.toMatchObject({
            code: HiringErrorCode.InterviewNotFound,
        })
    })

    it("requires an active member for availability", async () => {
        const { service, data } = await build()
        data.memberName.mockResolvedValue(undefined)
        const request = { memberUserId: "missing", windows: [] }
        await expect(service.saveAvailability("user-1", "ws-1", request)).rejects.toMatchObject({
            code: HiringErrorCode.MemberNotFound,
        })
    })

    it.each([
        { weekday: 1.5, startMin: 540, endMin: 600 },
        { weekday: -1, startMin: 540, endMin: 600 },
        { weekday: 7, startMin: 540, endMin: 600 },
        { weekday: 1, startMin: -1, endMin: 600 },
        { weekday: 1, startMin: 540, endMin: 1441 },
        { weekday: 1, startMin: 540, endMin: 540 },
        { weekday: 1, startMin: 540, endMin: 530 },
    ])("rejects invalid availability $weekday $startMin $endMin", async (window) => {
        const em = mockEntityManager()
        const { service } = await build(em)
        const request = { memberUserId: "member-1", windows: [window] }
        await expect(service.saveAvailability("user-1", "ws-1", request)).rejects.toMatchObject({
            code: HiringErrorCode.AvailabilityInvalid,
        })
        expect(em.query).not.toHaveBeenCalled()
    })

    it.each([
        { rows: [{ value: 2 }], saved: 2 },
        { rows: [], saved: 0 },
        { rows: [{ value: null }], saved: 0 },
    ])("saves windows with count $saved", async ({ rows, saved }) => {
        const em = mockEntityManager({ query: [SAVE_AVAILABILITY, rows] })
        const { service, members, data } = await build(em)
        const windows = [
            { weekday: 0, startMin: 0, endMin: 1440 },
            { weekday: 6, startMin: 540, endMin: 600 },
        ]
        const request = { memberUserId: "member-1", windows }
        await expect(service.saveAvailability("user-1", "ws-1", request)).resolves.toEqual({ saved })
        expect(members.require.mock.calls).toEqual([roleCall])
        expect(data.memberName.mock.calls).toEqual([["ws-1", "member-1"]])
        expect(em.query.mock.calls).toEqual([[SAVE_AVAILABILITY, ["ws-1", "member-1", JSON.stringify(windows)]]])
    })

    it("ignores reminders without a confirmed start or existing candidate", async () => {
        const em = mockEntityManager({ query: [CLAIM_REMINDER, [{ value: true }]] })
        const { service, data, notify, office } = await build(em)
        await expect(service.remind(interviewOf({ slotStart: null }), "Coffee Shop")).resolves.toBe(false)
        expect(em.query).not.toHaveBeenCalled()
        data.candidate.mockResolvedValue(undefined)
        await expect(service.remind(interviewOf(), "Coffee Shop")).resolves.toBe(false)
        expect(notify.toCandidate).not.toHaveBeenCalled()
        expect(office.postOffice).not.toHaveBeenCalled()
    })

    it.each([{ rows: [] }, { rows: [{ value: false }] }])("ignores unclaimed reminders $rows", async ({ rows }) => {
        const em = mockEntityManager({ query: [CLAIM_REMINDER, rows] })
        const { service, data } = await build(em)
        await expect(service.remind(interviewOf(), "Coffee Shop")).resolves.toBe(false)
        expect(em.query.mock.calls).toEqual([[CLAIM_REMINDER, ["interview-1"]]])
        expect(data.candidate).not.toHaveBeenCalled()
    })

    it.each([true, false])("records a reminder with delivery=$hasWork", async (hasWork) => {
        const em = mockEntityManager({
            query: [
                [CLAIM_REMINDER, [{ value: true }]],
                [LOG_EVENT, []],
            ],
        })
        const { service, data, notify, office } = await build(em)
        if (!hasWork) data.jobHead.mockResolvedValue(undefined)
        const interview = hasWork ? interviewOf() : interviewOf({ workItemId: null, location: "", interviewerName: "" })
        await expect(service.remind(interview, "Coffee Shop")).resolves.toBe(true)
        const title = hasWork ? "Barista" : ""
        const reminder = {
            subject: text("hiring.interview.reminderSubject", { title }),
            text: text("hiring.interview.reminder", {
                name: "Alice",
                title,
                when,
                place: " (Main Street)",
                shop: "Coffee Shop",
            }),
            workItemId: "work-1",
        }
        expect(notify.toCandidate.mock.calls).toEqual(hasWork ? [[candidateOf(), reminder]] : [])
        const event = text("hiring.event.reminder", { when, note: hasWork ? "delivery-note" : "" })
        const args = ["ws-1", "candidate-1", "interview_reminder", text("hiring.actor"), event]
        expect(em.query.mock.calls).toEqual([
            [CLAIM_REMINDER, ["interview-1"]],
            [LOG_EVENT, args],
        ])
        const line = text("hiring.office.reminder", {
            name: "Alice",
            title,
            when,
            who: hasWork ? text("hiring.office.withWho", { who: "Bob" }) : "",
        })
        expect(office.postOffice.mock.calls).toEqual([["ws-1", line]])
    })
})
