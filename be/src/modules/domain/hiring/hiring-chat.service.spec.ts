import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { JobRecord } from "./hiring.contracts"
import { HiringCandidatesService } from "./hiring-candidates.service"
import { HiringChatService } from "./hiring-chat.service"
import type { ChatApplication } from "./hiring-chat.service"
import { HiringDataService } from "./hiring-data.service"
import { HiringTextService } from "./hiring-text.service"

const text = (key: string, params: Readonly<Record<string, string | number>> = {}): string =>
    `${key}${JSON.stringify(params)}`

const jobOf = (overrides: Partial<JobRecord> = {}): JobRecord => ({
    id: "job-1",
    workspaceId: "ws-1",
    slug: "cashier",
    title: "Cashier",
    position: "Counter",
    employmentType: "part_time",
    schedule: "Evenings",
    payMinVnd: 30000,
    payMaxVnd: 40000,
    payUnit: "hour",
    location: "Market",
    headcount: 2,
    description: "Serve customers",
    requirements: {
        skills: ["POS"],
        experienceYears: 1,
        experienceNote: "Retail",
        availability: ["Evenings"],
        mustHave: ["Handle payments"],
        niceToHave: ["Stock shelves"],
    },
    questions: [
        { id: "q-1", text: "Can you use POS?", type: "yesno", required: true, choices: ["ignored"], expect: "yes" },
        {
            id: "q-2",
            text: "Choose a shift",
            type: "choice",
            required: false,
            choices: ["Early", "Late"],
            expect: ["Late"],
        },
        { id: "q-3", text: "Choose a team", type: "choice", required: false },
    ],
    status: "open",
    channels: ["chat"],
    closesAt: null,
    ...overrides,
})

const application: ChatApplication = {
    job: "cashier",
    name: "Alice",
    phone: "0901234567",
    email: "alice@example.com",
    availability: "Evenings",
    consent: true,
    answers: [{ questionId: "q-1", answer: "yes" }],
}

const build = async () => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const words = mock<HiringTextService>()
    words.text.mockImplementation((key, params) => catalog.get(key, params ?? {}, "vi"))
    words.textOf.mockImplementation((key, params) => catalog.get(key, params, "vi"))
    words.amount.mockImplementation((amount) => `amount:${amount}`)
    const data = mock<HiringDataService>()
    data.chatJobs.mockResolvedValue([])
    data.jobBySlug.mockResolvedValue(jobOf())
    const candidates = mock<HiringCandidatesService>()
    candidates.submit.mockResolvedValue({ candidateId: "candidate-1", duplicate: false })
    const moduleRef = await Test.createTestingModule({
        providers: [
            HiringChatService,
            { provide: CLOCK, useValue: new FakeClock("2026-10-13T00:00:00.000Z") },
            { provide: HiringDataService, useValue: data },
            { provide: HiringTextService, useValue: words },
            { provide: HiringCandidatesService, useValue: candidates },
        ],
    }).compile()
    return { service: moduleRef.get(HiringChatService), data, words, catalog, candidates }
}

describe("HiringChatService", () => {
    describe("brief", () => {
        it("returns an empty brief when there are no jobs", async () => {
            const { service, data, words } = await build()

            await expect(service.brief("ws-1")).resolves.toBe("")

            expect(data.chatJobs.mock.calls).toEqual([["ws-1"]])
            expect(words.text).not.toHaveBeenCalled()
        })

        it("returns an empty brief when all jobs have expired", async () => {
            const { service, data, words } = await build()
            data.chatJobs.mockResolvedValue([jobOf({ closesAt: "2026-10-12T23:59:59.999Z" })])

            await expect(service.brief("ws-1")).resolves.toBe("")

            expect(words.text).not.toHaveBeenCalled()
        })

        it("describes criteria, pay and questions while ignoring choices on non-choice questions", async () => {
            const { service, data, words, catalog } = await build()
            data.chatJobs.mockResolvedValue([jobOf()])
            const line = text("hiring.chat.job", {
                slug: "cashier",
                title: "Cashier",
                employment: text("hiring.employment.part_time"),
                pay: text("hiring.pay.range", {
                    min: "amount:30000",
                    max: "amount:40000",
                    unit: text("hiring.payUnit.hour"),
                }),
                place: "Market",
                schedule: "Evenings",
                criteria: [
                    text("hiring.criteria.skills", { list: "POS" }),
                    text("hiring.criteria.experienceYears", { years: 1, note: " (Retail)" }),
                    text("hiring.criteria.availability", { list: "Evenings" }),
                    text("hiring.criteria.mustHave", { list: "Handle payments" }),
                    text("hiring.criteria.niceToHave", { list: "Stock shelves" }),
                ].join("; "),
                questions: [
                    text("hiring.chat.question", { id: "q-1", star: "*", text: "Can you use POS?", choices: "" }),
                    text("hiring.chat.question", {
                        id: "q-2",
                        star: "",
                        text: "Choose a shift",
                        choices: text("hiring.chat.choices", { list: "Early / Late" }),
                    }),
                    text("hiring.chat.question", { id: "q-3", star: "", text: "Choose a team", choices: "" }),
                ].join("\n"),
            })

            await expect(service.brief("ws-1")).resolves.toBe(
                text("hiring.chat.brief", {
                    clause: text("hiring.chat.clause"),
                    shape: text("hiring.chat.shape"),
                    jobs: line,
                }),
            )

            expect(words.amount.mock.calls).toEqual([[30000], [40000]])
            expect(catalog.get).toHaveBeenCalledWith("hiring.chat.choices", { list: "Early / Late" }, "vi")
            expect(words.text.mock.calls).toEqual([
                ["hiring.chat.clause"],
                ["hiring.chat.shape"],
                [
                    "hiring.chat.brief",
                    { clause: text("hiring.chat.clause"), shape: text("hiring.chat.shape"), jobs: line },
                ],
            ])
        })

        it("includes jobs closing now or later in order and supplies missing content labels", async () => {
            const { service, data, words } = await build()
            const empty = jobOf({
                title: "Helper",
                employmentType: "full_time",
                payMinVnd: null,
                payMaxVnd: null,
                location: "",
                schedule: "",
                requirements: {
                    skills: [],
                    experienceYears: null,
                    experienceNote: "",
                    availability: [],
                    mustHave: [],
                    niceToHave: [],
                },
                questions: [],
            })
            data.chatJobs.mockResolvedValue([
                jobOf({ slug: "expired", closesAt: "2026-10-12T23:59:59.999Z" }),
                { ...empty, slug: "now", closesAt: "2026-10-13T00:00:00.000Z" },
                { ...empty, slug: "later", closesAt: "2026-10-14T00:00:00.000Z" },
            ])
            const expectedNow = text("hiring.chat.job", {
                slug: "now",
                title: "Helper",
                employment: text("hiring.employment.full_time"),
                pay: text("hiring.pay.negotiable"),
                place: text("hiring.chat.noPlace"),
                schedule: "",
                criteria: text("hiring.chat.noCriteria"),
                questions: text("hiring.chat.noQuestions"),
            })
            const expectedLater = text("hiring.chat.job", {
                slug: "later",
                title: "Helper",
                employment: text("hiring.employment.full_time"),
                pay: text("hiring.pay.negotiable"),
                place: text("hiring.chat.noPlace"),
                schedule: "",
                criteria: text("hiring.chat.noCriteria"),
                questions: text("hiring.chat.noQuestions"),
            })

            await expect(service.brief("ws-1")).resolves.toBe(
                text("hiring.chat.brief", {
                    clause: text("hiring.chat.clause"),
                    shape: text("hiring.chat.shape"),
                    jobs: `${expectedNow}\n${expectedLater}`,
                }),
            )

            expect(words.amount).not.toHaveBeenCalled()
        })
    })

    describe("register", () => {
        it("returns a missing-job message when the slug is unknown", async () => {
            const { service, data, candidates } = await build()
            data.jobBySlug.mockResolvedValue(undefined)

            await expect(service.register("ws-1", "conversation-1", application)).resolves.toEqual({
                ok: false,
                message: text("hiring.chat.noJob"),
            })

            expect(data.jobBySlug.mock.calls).toEqual([["ws-1", "cashier"]])
            expect(candidates.submit).not.toHaveBeenCalled()
        })

        it("returns a missing-job message when the job has no chat channel", async () => {
            const { service, data, candidates } = await build()
            data.jobBySlug.mockResolvedValue(jobOf({ channels: ["page"] }))

            await expect(service.register("ws-1", "conversation-1", application)).resolves.toEqual({
                ok: false,
                message: text("hiring.chat.noJob"),
            })

            expect(candidates.submit).not.toHaveBeenCalled()
        })

        it.each([
            { duplicate: false, key: "hiring.chat.stored" },
            { duplicate: true, key: "hiring.chat.duplicate" },
        ])("returns $key after submitting the chat application", async ({ duplicate, key }) => {
            const { service, data, candidates } = await build()
            const job = jobOf()
            data.jobBySlug.mockResolvedValue(job)
            candidates.submit.mockResolvedValue({ candidateId: "candidate-1", duplicate })

            await expect(service.register("ws-1", "conversation-1", application)).resolves.toEqual({
                ok: true,
                message: text(key),
                candidateId: "candidate-1",
            })

            expect(candidates.submit.mock.calls).toEqual([
                ["ws-1", job, "chat", application, { conversationId: "conversation-1" }],
            ])
        })

        it("returns the message of an application failure without throwing", async () => {
            const { service, candidates } = await build()
            candidates.submit.mockRejectedValue(new Error("submission failed"))

            await expect(service.register("ws-1", "conversation-1", application)).resolves.toEqual({
                ok: false,
                message: "submission failed",
            })
        })

        it("converts a non-error lookup failure to text without throwing", async () => {
            const { service, data, candidates } = await build()
            data.jobBySlug.mockRejectedValue(42)

            await expect(service.register("ws-1", "conversation-1", application)).resolves.toEqual({
                ok: false,
                message: "42",
            })

            expect(candidates.submit).not.toHaveBeenCalled()
        })
    })
})
