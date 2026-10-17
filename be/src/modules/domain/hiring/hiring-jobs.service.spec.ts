import {
    text,
    requirementsOf,
    cleanAds,
    retries,
    adOutput,
    minimalFacts,
} from "@tests/fixtures/builders/hiring-jobs.builder"
import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OfficeLog, ModuleTextGenerator } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { MessageCatalog } from "@modules/platform/i18n"
import { HiringErrorCode } from "./errors/hiring.error"
import type { HiringSettings, JobQuestion, JobRecord } from "./hiring.contracts"
import type { GenerateAdOutput, SaveJobParams, SetJobStatusParams } from "./hiring-operations.contracts"
import { HiringDataService } from "./hiring-data.service"
import { HiringJobsService } from "./hiring-jobs.service"
import { HiringLinksService } from "./hiring-links.service"
import { HiringSettingsService } from "./hiring-settings.service"
import { HiringTextService } from "./hiring-text.service"
import { CREATE_JOB, SET_JOB_ADS, SET_JOB_STATUS, UPDATE_JOB } from "./persistence/hiring.sql"
const commonFields: Omit<JobRecord, "id" | "workspaceId" | "slug" | "status"> = {
    title: "Cashier",
    position: "",
    employmentType: "full_time",
    schedule: "",
    payMinVnd: null,
    payMaxVnd: null,
    payUnit: "month",
    location: "",
    headcount: 1,
    description: "",
    requirements: requirementsOf(),
    questions: [],
    channels: ["page", "chat"],
    closesAt: null,
}
const jobOf = (overrides: Partial<JobRecord> = {}): JobRecord => ({
    id: "job-1",
    workspaceId: "ws-1",
    slug: "cashier",
    ...commonFields,
    status: "draft",
    ...overrides,
})
const settingsOf = (): HiringSettings => ({
    workspaceId: "ws-1",
    publicSlug: "shop",
    retentionDays: 90,
    notifyNewCandidate: true,
    remindInterview: true,
    autoCloseWhenFilled: false,
    applyConsentText: "Store my application details",
    adTone: "Clear",
})
const requestOf = (overrides: Partial<SaveJobParams> = {}): SaveJobParams => ({
    title: "Cashier",
    questions: [],
    ...overrides,
})
const fieldsOf = (overrides: Record<string, unknown> = {}): string =>
    JSON.stringify({
        ...commonFields,
        requirements: {
            skills: [],
            experience_years: null,
            experience_note: "",
            availability: [],
            must_have: [],
            nice_to_have: [],
        },
        ...overrides,
    })
const fairnessParams = (field: string) => ({
    parts: `hiring.field.${field}{}: "nu cashier" (hiring.fairness.gender{})`,
    more: "",
    advice: "hiring.fairness.advice{}",
})
const unfairError = (field: string) => ({
    code: HiringErrorCode.Unfair,
    params: { detail: text("hiring.fairness.refusal", fairnessParams(field)) },
})
const createQuery = (slug = "cashier", fields = fieldsOf()) => [CREATE_JOB, ["ws-1", "user-1", slug, fields]]
const build = async (entityManager: MockEntityManager) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const words = mock<HiringTextService>()
    words.text.mockImplementation((key, params) => catalog.get(key, params ?? {}, "vi"))
    words.textOf.mockImplementation((key, params) => catalog.get(key, { ...params }, "vi"))
    words.amount.mockImplementation((value) => `amount:${value}`)
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "manager",
        staffId: null,
        displayName: "Alex",
        status: "active",
    })
    const data = mock<HiringDataService>()
    data.job.mockResolvedValue(jobOf())
    const generator = mock<ModuleTextGenerator>()
    const settings = mock<HiringSettingsService>()
    settings.ensure.mockResolvedValue(settingsOf())
    const links = mock<HiringLinksService>()
    links.job.mockReturnValue("https://jobs.example/shop/cashier")
    const office = mock<OfficeLog>()
    office.workspaceName.mockResolvedValue("Shop")
    const clock = new FakeClock("2026-10-13T08:00:00.000Z")
    const moduleRef = await Test.createTestingModule({
        providers: [
            HiringJobsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: clock },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: HiringDataService, useValue: data },
            { provide: HiringTextService, useValue: words },
            { provide: ModuleTextGenerator, useValue: generator },
            { provide: HiringSettingsService, useValue: settings },
            { provide: HiringLinksService, useValue: links },
            { provide: OfficeLog, useValue: office },
        ],
    }).compile()
    const service = moduleRef.get(HiringJobsService)
    return { service, members, data, generator, settings, links, office, words, clock, catalog }
}
const question: JobQuestion = { id: "available", text: "Available Monday?", type: "yesno", required: true }
const generationRequest = (feedback = "") => ({
    workspaceId: "ws-1",
    purpose: "hiring_job_ad",
    module: "hiring",
    system: "hiring.ad.system{}",
    user: text("hiring.ad.user", { shop: "Shop", tone: "Clear", facts: minimalFacts() }) + feedback,
    timeoutMs: 100000,
})
const expectStoredAds = (em: MockEntityManager, output: GenerateAdOutput) => {
    const { facebook, zalo, topcv, generatedAt, ms } = output
    expect(em.query.mock.calls).toEqual([
        [SET_JOB_ADS, ["ws-1", "job-1", JSON.stringify({ facebook, zalo, topcv, generated_at: generatedAt, ms })]],
    ])
}

const createCases = [
    { request: requestOf(), slug: "cashier", fields: fieldsOf() },
    { request: requestOf({ title: "!!!" }), slug: "tuyen-dung", fields: fieldsOf({ title: "!!!" }) },
    ...[
        [null, 20000],
        [10000, null],
        [10000, 10000],
    ].map(([payMinVnd, payMaxVnd]) => ({
        request: requestOf({ payMinVnd, payMaxVnd, payUnit: "month" }),
        slug: "cashier",
        fields: fieldsOf({ payMinVnd, payMaxVnd }),
    })),
    {
        request: requestOf({
            title: "T".repeat(150),
            position: "P".repeat(130),
            employmentType: "full_time",
            schedule: "S".repeat(310),
            description: "D".repeat(6010),
            location: "L".repeat(310),
            payUnit: "shift",
            closesAt: null,
        }),
        slug: "t".repeat(60),
        fields: fieldsOf({
            title: "T".repeat(140),
            position: "P".repeat(120),
            schedule: "S".repeat(300),
            description: "D".repeat(6000),
            location: "L".repeat(300),
            payUnit: "shift",
        }),
    },
]

const nonOpen: Array<SetJobStatusParams["status"]> = ["draft", "paused", "closed"]

const cases: Array<{ status: SetJobStatusParams["status"]; job: JobRecord; settings: Array<Array<string>> }> = [
    ...nonOpen.map((status) => ({ status, job: jobOf(), settings: [] })),
    { status: "open", job: jobOf({ description: "Help customers" }), settings: [["ws-1"]] },
    {
        status: "open",
        job: jobOf({ description: "   ", requirements: requirementsOf({ skills: ["Register"] }) }),
        settings: [["ws-1"]],
    },
    {
        status: "open",
        job: jobOf({ requirements: requirementsOf({ mustHave: ["Counting"] }) }),
        settings: [["ws-1"]],
    },
]

describe("HiringJobsService", () => {
    it.each(createCases)("creates $slug with cleaned fields", async ({ request, slug, fields }) => {
        const em = mockEntityManager({ query: [CREATE_JOB, [{ id: "job-1" }]] })
        const { service, members } = await build(em)
        await expect(service.saveJob("user-1", "ws-1", request)).resolves.toEqual({ id: "job-1", slug })
        expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
        expect(em.query.mock.calls).toEqual([createQuery(slug, fields)])
    })
})

describe("HiringJobsService", () => {
    it("cleans supplied fields and stores requirements and questions in row format", async () => {
        const em = mockEntityManager({ query: [CREATE_JOB, [{ id: "job-1" }]] })
        const { service } = await build(em)
        const request = requestOf({
            title: "Shop Cashier",
            position: "Cashier",
            employmentType: "part_time",
            schedule: "Monday evenings",
            payMinVnd: 10000,
            payMaxVnd: 20001,
            payUnit: "hour",
            location: "Main Street",
            headcount: 3,
            description: "Help customers",
            closesAt: "2026-11-01T01:00:00.000Z",
            requirements: requirementsOf({
                skills: ["Counting"],
                experienceYears: 2,
                experienceNote: "Retail",
                availability: ["Monday"],
                mustHave: ["Register skills"],
                niceToHave: ["Stock skills"],
            }),
            questions: [{ ...question, expectYesNo: "yes" }],
            channels: ["page", "chat"],
        })
        const dirty: SaveJobParams = {
            ...request,
            title: "  Shop Cashier  ",
            position: "  Cashier  ",
            schedule: "  Monday evenings  ",
            payMinVnd: 10000.4,
            payMaxVnd: 20000.6,
            location: "  Main Street  ",
            headcount: 2.6,
            description: "  Help customers  ",
            closesAt: "2026-11-01T08:00:00+07:00",
            requirements: requirementsOf({
                skills: ["  Counting  ", ""],
                experienceYears: 2,
                experienceNote: "  Retail  ",
                availability: ["  Monday  "],
                mustHave: ["  Register skills  "],
                niceToHave: ["  Stock skills  "],
            }),
            questions: [{ ...question, text: "  Available Monday?  ", expectYesNo: "yes" }],
            channels: ["page", "foreign", "chat"],
        }
        await expect(service.saveJob("user-1", "ws-1", dirty)).resolves.toEqual({
            id: "job-1",
            slug: "shop-cashier",
        })
        const expected = fieldsOf({
            ...request,
            requirements: {
                skills: ["Counting"],
                experience_years: 2,
                experience_note: "Retail",
                availability: ["Monday"],
                must_have: ["Register skills"],
                nice_to_have: ["Stock skills"],
            },
            questions: [{ ...question, expect: "yes" }],
        })
        expect(em.query.mock.calls).toEqual([createQuery("shop-cashier", expected)])
    })
})

describe("HiringJobsService", () => {
    it.each([
        { rows: [[], [{ id: null }], [{ id: "job-3" }]], result: { id: "job-3", slug: "cashier-3" }, count: 3 },
        { rows: [[]], result: null, count: 30 },
    ])("retries unavailable slugs exactly $count times", async ({ rows, result, count }) => {
        const em = mockEntityManager({ query: rows.map((row): [string, unknown] => [CREATE_JOB, row]) })
        const { service } = await build(em)
        const saved = expect(service.saveJob("user-1", "ws-1", requestOf()))
        if (result === null) await saved.rejects.toMatchObject({ code: HiringErrorCode.JobSlugUnavailable })
        else await saved.resolves.toEqual(result)
        expect(em.query.mock.calls).toEqual(
            Array.from({ length: count }, (_, index) => createQuery(index === 0 ? "cashier" : `cashier-${index + 1}`)),
        )
    })

    it.each([
        { rows: [{ value: true }], job: jobOf({ slug: "original-cashier" }), reads: [["ws-1", "job-1"]] },
        { rows: [], job: undefined, reads: [] },
        { rows: [{ value: false }], job: undefined, reads: [] },
        { rows: [{ value: true }], job: undefined, reads: [["ws-1", "job-1"]] },
    ])("updates or refuses an unavailable job with result $rows", async ({ rows, job, reads }) => {
        const em = mockEntityManager({ query: [UPDATE_JOB, rows] })
        const { service, data } = await build(em)
        data.job.mockResolvedValue(job)
        const saved = expect(service.saveJob("user-1", "ws-1", requestOf({ id: "job-1" })))
        if (job === undefined) await saved.rejects.toMatchObject({ code: HiringErrorCode.JobNotFound })
        else await saved.resolves.toEqual({ id: "job-1", slug: "original-cashier" })
        expect(em.query.mock.calls).toEqual([[UPDATE_JOB, ["ws-1", "job-1", fieldsOf()]]])
        expect(data.job.mock.calls).toEqual(reads)
    })

    it.each([
        { request: requestOf({ title: "  Ab  " }), error: { code: HiringErrorCode.JobTitleInvalid } },
        {
            request: requestOf({ payMinVnd: 20000, payMaxVnd: 10000 }),
            error: { code: HiringErrorCode.PayRangeInvalid },
        },
        { request: requestOf({ title: "nu cashier" }), error: unfairError("title") },
    ])("refuses invalid input with $error.code before writing", async ({ request, error }) => {
        const em = mockEntityManager()
        const { service, catalog } = await build(em)
        await expect(service.saveJob("user-1", "ws-1", request)).rejects.toMatchObject(error)
        if (error.code === HiringErrorCode.Unfair)
            expect(catalog.get.mock.calls).toEqual([
                ["hiring.field.title", {}, "vi"],
                ["hiring.fairness.gender", {}, "vi"],
                ["hiring.fairness.advice", {}, "vi"],
                ["hiring.fairness.refusal", fairnessParams("title"), "vi"],
            ])
        expect(em.query).not.toHaveBeenCalled()
    })

    it("propagates membership refusal before validating or saving", async () => {
        const em = mockEntityManager()
        const { service, members } = await build(em)
        const failure = new Error("Membership refused")
        members.require.mockRejectedValue(failure)
        await expect(service.saveJob("user-1", "ws-1", requestOf())).rejects.toBe(failure)
        expect(em.query).not.toHaveBeenCalled()
    })
})

describe("HiringJobsService", () => {
    it.each([jobOf(), undefined])("returns a known job or refuses a missing job %j", async (job) => {
        const { service, data } = await build(mockEntityManager())
        data.job.mockResolvedValue(job)
        const required = expect(service.requireJob("ws-1", "job-1"))
        if (job === undefined) await required.rejects.toMatchObject({ code: HiringErrorCode.JobNotFound })
        else await required.resolves.toEqual(jobOf())
        expect(data.job.mock.calls).toEqual([["ws-1", "job-1"]])
    })

    it.each(cases)("sets $status and ensures settings", async ({ status, job, settings: calls }) => {
        const em = mockEntityManager({ query: [SET_JOB_STATUS, [{ value: true }]] })
        const { service, members, data, settings } = await build(em)
        data.job.mockResolvedValue(job)
        await expect(service.setStatus("user-1", "ws-1", { id: "job-1", status })).resolves.toEqual({ status })
        expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
        expect(em.query.mock.calls).toEqual([[SET_JOB_STATUS, ["ws-1", "job-1", status]]])
        expect(settings.ensure.mock.calls).toEqual(calls)
    })

    it.each([
        { job: jobOf(), error: { code: HiringErrorCode.JobNeedsContent } },
        { job: jobOf({ description: "nu cashier" }), error: unfairError("description") },
    ])("refuses an open job with $error.code", async ({ job, error }) => {
        const em = mockEntityManager()
        const { service, data, settings } = await build(em)
        data.job.mockResolvedValue(job)
        await expect(service.setStatus("user-1", "ws-1", { id: "job-1", status: "open" })).rejects.toMatchObject(error)
        expect(settings.ensure).not.toHaveBeenCalled()
        expect(em.query).not.toHaveBeenCalled()
    })

    it("omits empty optional facts and lists", async () => {
        const { service, words } = await build(mockEntityManager())
        expect(service.jobFacts(jobOf())).toBe(minimalFacts())
        expect(words.amount).not.toHaveBeenCalled()
    })
})

describe("HiringJobsService", () => {
    it("includes every fact with exact list separators and formatted pay", async () => {
        const { service, words } = await build(mockEntityManager())
        const job = jobOf({
            position: "Register operator",
            employmentType: "part_time",
            schedule: "Monday evenings",
            payMinVnd: 10000,
            payMaxVnd: 20000,
            payUnit: "hour",
            location: "Main Street",
            headcount: 3,
            description: "Help customers",
            requirements: requirementsOf({
                skills: ["Register", "Counting"],
                experienceYears: 2,
                experienceNote: "Retail",
                availability: ["Monday", "Friday"],
                mustHave: ["Cash handling", "Register skills"],
                niceToHave: ["Stock skills", "Service skills"],
            }),
        })
        const pay = text("hiring.pay.range", {
            min: "amount:10000",
            max: "amount:20000",
            unit: text("hiring.payUnit.hour"),
        })
        expect(service.jobFacts(job)).toBe(
            [
                text("hiring.facts.title", { title: "Cashier" }),
                text("hiring.facts.position", { position: "Register operator" }),
                text("hiring.facts.employment", { employment: text("hiring.employment.part_time") }),
                text("hiring.facts.schedule", { schedule: "Monday evenings" }),
                text("hiring.facts.pay", { pay }),
                text("hiring.facts.place", { place: "Main Street" }),
                text("hiring.facts.headcount", { count: 3 }),
                text("hiring.facts.description", { description: "Help customers" }),
                text("hiring.facts.skills", { list: "Register, Counting" }),
                text("hiring.facts.experienceYears", { years: 2, note: " (Retail)" }),
                text("hiring.facts.availability", { list: "Monday, Friday" }),
                text("hiring.facts.mustHave", { list: "Cash handling; Register skills" }),
                text("hiring.facts.niceToHave", { list: "Stock skills; Service skills" }),
            ].join("\n"),
        )
        expect(words.amount.mock.calls).toEqual([[10000], [20000]])
    })
})

describe("HiringJobsService", () => {
    it("fills every placeholder, appends missing links and stores exact elapsed time", async () => {
        const em = mockEntityManager({ query: [SET_JOB_ADS, [{ value: true }]] })
        const { service, members, data, settings, office, links, generator, clock } = await build(em)
        generator.generate.mockImplementation(() => {
            clock.advance(250)
            return Promise.resolve({
                ok: true,
                output: JSON.stringify({
                    facebook: "Facebook {{link}} again {{link}}",
                    zalo: "Zalo post",
                    topcv: "Board {{link}}",
                }),
            })
        })
        const output = adOutput({
            facebook: "Facebook https://jobs.example/shop/cashier again https://jobs.example/shop/cashier",
            zalo: `Zalo post\n\n${text("hiring.ad.apply", { link: "https://jobs.example/shop/cashier" })}`,
            generatedAt: "2026-10-13T08:00:00.250Z",
            ms: 250,
        })
        await expect(service.generateAd("user-1", "ws-1", { jobId: "job-1" })).resolves.toEqual(output)
        expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
        expect(data.job.mock.calls).toEqual([["ws-1", "job-1"]])
        expect(settings.ensure.mock.calls).toEqual([["ws-1"]])
        expect(office.workspaceName.mock.calls).toEqual([["ws-1"]])
        expect(links.job.mock.calls).toEqual([["shop", "cashier"]])
        expect(generator.generate.mock.calls).toEqual([[generationRequest()]])
        expectStoredAds(em, output)
    })

    it.each(retries)("retries %s with exact feedback and sanitising", async (first, second, feedback, sanitised) => {
        const em = mockEntityManager({ query: [SET_JOB_ADS, [{ value: true }]] })
        const { service, generator } = await build(em)
        generator.generate
            .mockResolvedValueOnce({ ok: true, output: first })
            .mockResolvedValueOnce({ ok: true, output: second })
        const output = adOutput({ attempts: 2, sanitised })
        await expect(service.generateAd("user-1", "ws-1", { jobId: "job-1" })).resolves.toEqual(output)
        expect(generator.generate.mock.calls).toEqual([[generationRequest()], [generationRequest(feedback)]])
        expectStoredAds(em, output)
    })

    it.each([
        { written: { ok: false, output: "" }, calls: [generationRequest()] },
        ...["facebook", "zalo", "topcv"].map((field) => ({
            written: { ok: true, output: JSON.stringify({ ...cleanAds, [field]: "" }) },
            calls: [generationRequest(), generationRequest("hiring.ad.badFormat{}")],
        })),
    ])("refuses failed or repeatedly incomplete model output $written", async ({ written, calls }) => {
        const em = mockEntityManager()
        const { service, generator } = await build(em)
        generator.generate.mockResolvedValue(written)
        await expect(service.generateAd("user-1", "ws-1", { jobId: "job-1" })).rejects.toMatchObject({
            code: HiringErrorCode.AdFailed,
        })
        expect(generator.generate.mock.calls).toEqual(calls.map((request) => [request]))
        expect(em.query).not.toHaveBeenCalled()
    })
})
