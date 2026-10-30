import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OfficeLog } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { MessageCatalog } from "@modules/platform/i18n"
import { CvStorage } from "./cv-storage.port"
import { HiringErrorCode as Code } from "./errors/hiring.error"
import type { ApplicationSource, CandidateRecord, HiringSettings, JobRecord } from "./hiring.contracts"
import type { CandidateCvOutput, MoveCandidateParams } from "./hiring-operations.contracts"
import { HiringCandidatesService } from "./hiring-candidates.service"
import type { ApplicationExtras } from "./hiring-candidates.service"
import { HiringDataService } from "./hiring-data.service"
import { HiringScreeningService } from "./hiring-screening.service"
import { HiringSettingsService } from "./hiring-settings.service"
import { HiringTextService } from "./hiring-text.service"
import type { ApplicationInput } from "./policies/application.policy"

const SUBMIT_APPLICATION = 'SELECT * FROM "public"."hiring_application_submit"($1, $2, $3, $4, $5, $6)'
const MOVE_CANDIDATE = 'SELECT * FROM "public"."hiring_candidate_move"($1, $2, $3, $4, $5, $6)'
const SAVE_NOTES = 'SELECT * FROM "public"."hiring_candidate_notes"($1, $2, $3, $4, $5)'
const DELETE_CANDIDATES = 'SELECT * FROM "public"."hiring_candidates_delete"($1, $2)'
const LINK_STAFF = 'SELECT * FROM "public"."hiring_candidate_link_staff"($1, $2)'
const TOGGLE_ONBOARDING = 'SELECT * FROM "public"."hiring_onboarding_toggle"($1, $2, $3)'
const FILL_CHECK = 'SELECT * FROM "public"."hiring_job_fill_check"($1, $2)'

interface NotesRow {
    readonly hiring_candidate_notes: boolean
}
interface StaffLinkRow {
    readonly staff_id: string | null
    readonly missing: boolean
}
interface FilledRow {
    readonly closed: boolean
    readonly title: string
    readonly hired: number | string
    readonly headcount: number
}

const W = "ws-1"
const U = "user-1"
const C = "candidate-1"
const J = "job-1"
const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`
const refuse = (work: Promise<unknown>, code: Code, params: Record<string, string | number> = {}) =>
    expect(work).rejects.toMatchObject({ code, params })
const query = (em: MockEntityManager, sql: string, params: ReadonlyArray<unknown>) =>
    expect(em.query.mock.calls).toEqual([[sql, params]])
const managerCalls = [[U, W, ["owner", "manager"]]]
const candidateOf = builder<CandidateRecord>({
    id: C,
    workspaceId: W,
    jobId: J,
    name: "Alex",
    phone: "0901234567",
    email: "alex@example.com",
    source: "page",
    conversationId: null,
    cvPath: null,
    cvName: null,
    cvMime: null,
    answers: [],
    availability: "Morning",
    stage: "applied",
    staffId: null,
})
const jobOf = builder<JobRecord>({
    id: J,
    workspaceId: W,
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
    questions: [{ id: "skills", text: "Skills", type: "text", required: true }],
    status: "open",
    channels: ["page"],
    closesAt: null,
})
const settingsOf = builder<HiringSettings>({
    workspaceId: W,
    publicSlug: "cafe",
    retentionDays: 90,
    notifyNewCandidate: true,
    remindInterview: true,
    autoCloseWhenFilled: true,
    applyConsentText: "consent-version-1",
    adTone: "Friendly",
})
const inputOf = builder<ApplicationInput>({
    name: "  Alex   Smith  ",
    phone: "+84 901 234 567",
    email: " ALEX@EXAMPLE.COM ",
    availability: " Morning ",
    consent: true,
    answers: [{ questionId: "skills", answer: " Coffee " }],
})
const moveOf = builder<MoveCandidateParams>({ id: C, stage: "applied" })
const stored = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({
        name: "Alex Smith",
        phone: "0901234567",
        email: "alex@example.com",
        source: "page",
        conversationId: null,
        cvPath: null,
        cvName: null,
        cvMime: null,
        cvSize: null,
        answers: [{ question_id: "skills", question: "Skills", answer: "Coffee" }],
        availability: "Morning",
        ...overrides,
    })
const announce = (cv: string) => text("hiring.office.newCandidate", { title: "Barista", name: "Alex Smith", cv })
const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const words = mock<HiringTextService>()
    words.text.mockImplementation((key, params) => catalog.get(key, params ?? {}, "vi"))
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: U,
        workspaceId: W,
        role: "manager",
        staffId: null,
        displayName: "Manager",
        status: "active",
    })
    const office = mock<OfficeLog>()
    const storage = mock<CvStorage>()
    storage.remove.mockResolvedValue(1)
    const data = mock<HiringDataService>()
    data.candidate.mockResolvedValue(candidateOf())
    data.hasActiveOffer.mockResolvedValue(true)
    const settings = mock<HiringSettingsService>()
    settings.ensure.mockResolvedValue(settingsOf())
    const screening = mock<HiringScreeningService>()
    screening.requestScreening.mockResolvedValue({ status: "waiting_decision", workItemId: "work-1" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            HiringCandidatesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-13T08:00:00.000Z") },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: OfficeLog, useValue: office },
            { provide: CvStorage, useValue: storage },
            { provide: HiringDataService, useValue: data },
            { provide: HiringTextService, useValue: words },
            { provide: HiringSettingsService, useValue: settings },
            { provide: HiringScreeningService, useValue: screening },
        ],
    }).compile()
    return { service: moduleRef.get(HiringCandidatesService), members, office, storage, data, settings, screening }
}

describe("HiringCandidatesService", () => {
    it("returns the exact existing open candidate and refuses a missing candidate", async () => {
        const { service, data } = await build()
        const candidate = candidateOf()
        data.candidate.mockResolvedValue(candidate)
        await expect(service.requireCandidate(W, C)).resolves.toBe(candidate)
        await expect(service.requireOpenCandidate(W, C)).resolves.toBe(candidate)
        expect(data.candidate.mock.calls).toEqual([
            [W, C],
            [W, C],
        ])
        data.candidate.mockResolvedValue(undefined)
        await refuse(service.requireCandidate(W, "missing"), Code.CandidateNotFound)
    })

    it.each<CandidateRecord["stage"]>(["rejected", "withdrawn", "hired"])(
        "refuses a closed %s candidate",
        async (stage) => {
            const { service, data } = await build()
            data.candidate.mockResolvedValue(candidateOf({ stage }))
            await refuse(service.requireOpenCandidate(W, C), Code.CandidateClosed, {
                stage: text(`hiring.stage.${stage}`),
            })
        },
    )
})

describe("HiringCandidatesService", () => {
    describe("submit", () => {
        it.each([
            { job: jobOf({ status: "paused" }), input: inputOf(), code: Code.JobNotOpen },
            { job: jobOf({ closesAt: "2026-10-13T07:59:59.000Z" }), input: inputOf(), code: Code.JobExpired },
            { job: jobOf(), input: inputOf({ consent: false }), code: Code.ConsentRequired },
        ])("refuses $code before saving", async ({ job, input, code }) => {
            const em = mockEntityManager()
            const { service, settings } = await build(em)
            await refuse(service.submit(W, job, "page", input), code)
            expect(settings.ensure).not.toHaveBeenCalled()
            expect(em.query).not.toHaveBeenCalled()
        })
        const cv: ApplicationExtras = {
            conversationId: "conversation-1",
            cv: { path: "cv-1", name: "resume.pdf", mime: "application/pdf", size: 1024 },
            ipHash: "ip-hash-1",
        }
        const cvJson = stored({
            source: "chat",
            conversationId: "conversation-1",
            cvPath: "cv-1",
            cvName: "resume.pdf",
            cvMime: "application/pdf",
            cvSize: 1024,
        })
        type SubmitCase = [
            ApplicationSource,
            ApplicationExtras | undefined,
            string,
            boolean,
            boolean,
            string | null,
            boolean,
        ]
        it.each<SubmitCase>([
            ["page", undefined, stored(), true, false, announce(""), true],
            ["chat", cv, cvJson, true, false, announce(text("hiring.office.withCv")), true],
            ["manual", {}, stored({ source: "manual" }), false, false, null, true],
            ["page", {}, stored(), true, true, null, false],
        ])(
            "stores the %s application and exact extras and notifications",
            async (source, extras, json, notify, duplicate, line, screened) => {
                const em = mockEntityManager({ query: [SUBMIT_APPLICATION, [{ id: C, duplicate }]] })
                const { service, settings, office, screening } = await build(em)
                settings.ensure.mockResolvedValue(settingsOf({ notifyNewCandidate: notify }))
                await expect(service.submit(W, jobOf(), source, inputOf(), extras)).resolves.toEqual({
                    candidateId: C,
                    duplicate,
                })
                expect(settings.ensure.mock.calls).toEqual([[W]])
                query(em, SUBMIT_APPLICATION, [
                    W,
                    J,
                    json,
                    "consent-version-1",
                    source === "chat" ? "ip-hash-1" : null,
                    [text(`hiring.applied.${source}`), text("hiring.applied.consent")],
                ])
                expect(office.postOffice.mock.calls).toEqual(line === null ? [] : [[W, line]])
                expect(screening.requestScreening.mock.calls).toEqual(screened ? [[W, C, false]] : [])
            },
        )
        it("refuses an opening closed before insertion", async () => {
            const em = mockEntityManager({ query: [SUBMIT_APPLICATION, []] })
            const { service, office, screening } = await build(em)
            await refuse(service.submit(W, jobOf(), "page", inputOf()), Code.JobNotOpen)
            expect(office.postOffice).not.toHaveBeenCalled()
            expect(screening.requestScreening).not.toHaveBeenCalled()
        })
    })
})

describe("HiringCandidatesService", () => {
    describe("move", () => {
        it("refuses an unknown stage before reading the candidate", async () => {
            const { service, data, members } = await build()
            const request = moveOf()
            Object.defineProperty(request, "stage", { value: "foreign" })
            await refuse(service.move(U, W, request), Code.StageInvalid)
            expect(members.require.mock.calls).toEqual(managerCalls)
            expect(data.candidate).not.toHaveBeenCalled()
        })
        it("leaves an unchanged stage without a write or offer check", async () => {
            const em = mockEntityManager()
            const { service, data } = await build(em)
            await expect(service.move(U, W, moveOf())).resolves.toEqual({ stage: "applied" })
            expect(em.query).not.toHaveBeenCalled()
            expect(data.hasActiveOffer).not.toHaveBeenCalled()
        })
        const detail = text("hiring.fairness.reason", {
            trait: text("hiring.fairness.gender"),
            advice: text("hiring.fairness.advice"),
        })
        it.each<[MoveCandidateParams, Code, Record<string, string | number>]>([
            [moveOf({ stage: "hired" }), Code.StageHiredByOffer, {}],
            [moveOf({ stage: "offer" }), Code.StageOfferByOffer, {}],
            [moveOf({ stage: "rejected" }), Code.RejectReasonRequired, {}],
            [moveOf({ stage: "rejected", reason: " a " }), Code.RejectReasonRequired, {}],
            [moveOf({ stage: "rejected", reason: "nu candidate" }), Code.Unfair, { detail }],
        ])("refuses the move %j with %s", async (request, code, params) => {
            const em = mockEntityManager()
            const { service, data } = await build(em)
            data.hasActiveOffer.mockResolvedValue(false)
            await refuse(service.move(U, W, request), code, params)
            if (request.stage === "offer") expect(data.hasActiveOffer.mock.calls).toEqual([[C]])
            expect(em.query).not.toHaveBeenCalled()
        })
        it.each([
            moveOf({ stage: "offer" }),
            moveOf({ stage: "shortlisted" }),
            moveOf({ stage: "rejected", reason: ` ${"a".repeat(301)} ` }),
        ])("moves to $stage with the exact event and trimmed reason", async (request) => {
            const em = mockEntityManager({ query: [MOVE_CANDIDATE, [{ hiring_candidate_move: true }]] })
            const { service } = await build(em)
            const reason = request.stage === "rejected" ? "a".repeat(301) : ""
            const summary = text(request.stage === "rejected" ? "hiring.event.rejected" : "hiring.event.stage", {
                stage: text(`hiring.stage.${request.stage}`),
                reason: reason.slice(0, 300),
            })
            await expect(service.move(U, W, request)).resolves.toEqual({ stage: request.stage })
            query(em, MOVE_CANDIDATE, [W, C, request.stage, reason, "Manager", summary])
        })
    })
})

describe("HiringCandidatesService", () => {
    describe("saveNotes", () => {
        const detail = text("hiring.fairness.notes", { trait: text("hiring.fairness.gender") })
        it.each<[string, Array<NotesRow>, Code, Record<string, string | number>]>([
            ["nu", [], Code.Unfair, { detail }],
            ["Good skills", [], Code.CandidateNotFound, {}],
            ["Good skills", [{ hiring_candidate_notes: false }], Code.CandidateNotFound, {}],
        ])("refuses notes %s", async (notes, rows, code, params) => {
            const em = mockEntityManager({ query: [SAVE_NOTES, rows] })
            const { service } = await build(em)
            await refuse(service.saveNotes(U, W, { id: C, notes }), code, params)
            if (code === Code.Unfair) expect(em.query).not.toHaveBeenCalled()
        })
        it("stores four thousand characters with the manager and event", async () => {
            const em = mockEntityManager({ query: [SAVE_NOTES, [{ hiring_candidate_notes: true }]] })
            const { service, members } = await build(em)
            await expect(service.saveNotes(U, W, { id: C, notes: "a".repeat(4001) })).resolves.toBeUndefined()
            expect(members.require.mock.calls).toEqual(managerCalls)
            query(em, SAVE_NOTES, [W, C, "a".repeat(4000), "Manager", text("hiring.event.notes")])
        })
    })

    describe("deleteAll and delete", () => {
        it.each([
            { ids: [], rows: [], candidates: 0, files: 0, paths: [] },
            { ids: [C, "candidate-2"], rows: [], candidates: 2, files: 0, paths: [] },
            { ids: [C, "candidate-2"], rows: [{ hiring_candidates_delete: [] }], candidates: 2, files: 0, paths: [] },
            {
                ids: [C, "candidate-2"],
                rows: [{ hiring_candidates_delete: ["cv-1", "cv-2"] }],
                candidates: 2,
                files: 1,
                paths: ["cv-1", "cv-2"],
            },
        ])(
            "deletes $candidates candidates and returns $files removed files",
            async ({ ids, rows, candidates, files, paths }) => {
                const em = mockEntityManager({ query: [DELETE_CANDIDATES, rows] })
                const { service, storage } = await build(em)
                await expect(service.deleteAll(W, ids)).resolves.toEqual({ candidates, files })
                expect(em.query.mock.calls).toEqual(candidates === 0 ? [] : [[DELETE_CANDIDATES, [W, ids]]])
                expect(storage.remove.mock.calls).toEqual(paths.length === 0 ? [] : [[paths]])
            },
        )
        it("requires a manager and removes one known candidate", async () => {
            const em = mockEntityManager({ query: [DELETE_CANDIDATES, [{ hiring_candidates_delete: ["cv-1"] }]] })
            const { service, storage, members, data } = await build(em)
            await expect(service.delete(U, W, { id: C })).resolves.toEqual({ files: 1 })
            expect(members.require.mock.calls).toEqual(managerCalls)
            expect(data.candidate.mock.calls).toEqual([[W, C]])
            query(em, DELETE_CANDIDATES, [W, [C]])
            expect(storage.remove.mock.calls).toEqual([[["cv-1"]]])
        })
    })
})

describe("HiringCandidatesService", () => {
    describe("cv", () => {
        const url = "https://files.example.com/cv"
        const empty = { url: null, name: null, mime: null }
        type CvCase = [CandidateRecord, string | null, CandidateCvOutput, Array<[string]>]
        it.each<CvCase>([
            [candidateOf(), null, empty, []],
            [candidateOf({ cvPath: "cv-1", cvName: "resume.pdf", cvMime: "application/pdf" }), null, empty, [["cv-1"]]],
            [candidateOf({ cvPath: "cv-1" }), url, { url, name: "cv", mime: "application/pdf" }, [["cv-1"]]],
            [
                candidateOf({ cvPath: "cv-1", cvName: "resume.txt", cvMime: "text/plain" }),
                url,
                { url, name: "resume.txt", mime: "text/plain" },
                [["cv-1"]],
            ],
        ])("returns exact CV metadata for %j", async (candidate, signed, result, calls) => {
            const { service, data, storage, members } = await build()
            data.candidate.mockResolvedValue(candidate)
            storage.signedUrl.mockResolvedValue(signed)
            await expect(service.cv(U, W, { id: C })).resolves.toEqual(result)
            expect(members.require.mock.calls).toEqual(managerCalls)
            expect(storage.signedUrl.mock.calls).toEqual(calls)
        })
    })

    describe("linkStaff", () => {
        it.each<[CandidateRecord, Array<StaffLinkRow>, Code, boolean]>([
            [candidateOf(), [], Code.StaffNotHired, false],
            [candidateOf({ stage: "hired", staffId: "staff-1" }), [], Code.StaffLinked, false],
            [candidateOf({ stage: "hired" }), [], Code.StaffLinked, true],
            [candidateOf({ stage: "hired" }), [{ staff_id: null, missing: true }], Code.StaffLinked, true],
        ])("refuses staff linking for %j", async (candidate, rows, code, queried) => {
            const em = mockEntityManager({ query: [LINK_STAFF, rows] })
            const { service, data, office } = await build(em)
            data.candidate.mockResolvedValue(candidate)
            await refuse(service.linkStaff(U, W, { candidateId: C }), code)
            expect(em.query.mock.calls).toEqual(queried ? [[LINK_STAFF, [W, C]]] : [])
            expect(office.logEvidence).not.toHaveBeenCalled()
        })
        it("links a hired candidate and records the manager's evidence", async () => {
            const em = mockEntityManager({ query: [LINK_STAFF, [{ staff_id: "staff-1", missing: false }]] })
            const { service, data, members, office } = await build(em)
            data.candidate.mockResolvedValue(candidateOf({ stage: "hired" }))
            await expect(service.linkStaff(U, W, { candidateId: C })).resolves.toEqual({ staffId: "staff-1" })
            expect(members.require.mock.calls).toEqual(managerCalls)
            query(em, LINK_STAFF, [W, C])
            expect(office.logEvidence.mock.calls).toEqual([
                [
                    W,
                    {
                        kind: "hiring.staff_linked",
                        actor: "Manager",
                        summary: text("hiring.event.staffLinked", { name: "Alex" }),
                    },
                ],
            ])
        })
    })
})

describe("HiringCandidatesService", () => {
    describe("toggleOnboarding", () => {
        it.each([true, false])("stores the onboarding done value %s", async (done) => {
            const em = mockEntityManager({ query: [TOGGLE_ONBOARDING, [{ hiring_onboarding_toggle: true }]] })
            const { service, members } = await build(em)
            await expect(service.toggleOnboarding(U, W, { id: "step-1", done })).resolves.toBeUndefined()
            expect(members.require.mock.calls).toEqual(managerCalls)
            query(em, TOGGLE_ONBOARDING, [W, "step-1", done])
        })
        it.each([{ rows: [] }, { rows: [{ hiring_onboarding_toggle: false }] }])(
            "refuses missing onboarding for %j",
            async ({ rows }) => {
                const em = mockEntityManager({ query: [TOGGLE_ONBOARDING, rows] })
                const { service } = await build(em)
                await refuse(service.toggleOnboarding(U, W, { id: "missing", done: true }), Code.OnboardingNotFound)
            },
        )
    })

    describe("closeJobIfFilled", () => {
        const line = text("hiring.office.jobFilled", { title: "Barista", hired: 2, headcount: 2 })
        it.each<[Array<FilledRow>, boolean, Array<[string, string]>]>([
            [[], false, []],
            [[{ closed: false, title: "Barista", hired: 0, headcount: 1 }], false, []],
            [[{ closed: true, title: "Barista", hired: "2", headcount: 2 }], true, [[W, line]]],
        ])("returns the closed value for %j and announces only new closures", async (rows, closed, lines) => {
            const em = mockEntityManager({ query: [FILL_CHECK, rows] })
            const { service, office } = await build(em)
            await expect(service.closeJobIfFilled(W, J)).resolves.toBe(closed)
            query(em, FILL_CHECK, [W, J])
            expect(office.postOffice.mock.calls).toEqual(lines)
        })
    })
})
