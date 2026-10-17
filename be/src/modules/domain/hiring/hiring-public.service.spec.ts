import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { OfficeLog } from "@modules/domain/module-ops"
import { CLOCK } from "@modules/platform/clock"
import { CvStorage } from "./cv-storage.port"
import { HiringErrorCode } from "./errors/hiring.error"
import type { HiringSettings, JobRecord } from "./hiring.contracts"
import type { ApplyParams } from "./hiring-public.contracts"
import { HiringCandidatesService } from "./hiring-candidates.service"
import { HiringChatService } from "./hiring-chat.service"
import { HiringDataService } from "./hiring-data.service"
import { HiringPostingService } from "./hiring-posting.service"
import { HiringPublicService } from "./hiring-public.service"

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
        { id: "q-1", text: "Can you use POS?", type: "yesno", required: true, expect: "yes" },
        {
            id: "q-2",
            text: "Choose a shift",
            type: "choice",
            required: false,
            choices: ["Evening"],
            expect: ["Evening"],
        },
    ],
    status: "open",
    channels: ["page", "chat"],
    closesAt: null,
    ...overrides,
})

const settings: HiringSettings = {
    workspaceId: "ws-1",
    publicSlug: "shop",
    retentionDays: 90,
    notifyNewCandidate: true,
    remindInterview: true,
    autoCloseWhenFilled: false,
    applyConsentText: "consent-1",
    adTone: "tone-1",
}

const request = { ws: "shop", job: "cashier" }
const application: ApplyParams = {
    ...request,
    name: "Alice",
    phone: "0901234567",
    email: "alice@example.com",
    availability: "Evenings",
    consent: true,
    answers: [{ questionId: "q-1", answer: "yes" }],
}
const submission = {
    name: "Alice",
    phone: "0901234567",
    email: "alice@example.com",
    availability: "Evenings",
    consent: true,
    answers: [{ questionId: "q-1", answer: "yes" }],
}

const build = async (job = jobOf()) => {
    const office = mock<OfficeLog>()
    office.workspaceName.mockResolvedValue("Market Shop")
    const storage = mock<CvStorage>()
    storage.signedUpload.mockResolvedValue("upload-1")
    const data = mock<HiringDataService>()
    data.settingsBySlug.mockResolvedValue(settings)
    data.jobBySlug.mockResolvedValue(job)
    data.newToken.mockResolvedValue("token-1")
    const candidates = mock<HiringCandidatesService>()
    candidates.submit.mockResolvedValue({ candidateId: "candidate-1", duplicate: false })
    const chat = mock<HiringChatService>({
        brief: jest.fn().mockResolvedValue("[OPEN JOBS] barista"),
        register: jest.fn().mockResolvedValue({ ok: true, message: "stored", candidateId: "candidate-2" }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            HiringPublicService,
            HiringPostingService,
            { provide: CLOCK, useValue: new FakeClock("2026-10-13T00:00:00.000Z") },
            { provide: OfficeLog, useValue: office },
            { provide: CvStorage, useValue: storage },
            { provide: HiringDataService, useValue: data },
            { provide: HiringCandidatesService, useValue: candidates },
            { provide: HiringChatService, useValue: chat },
        ],
    }).compile()
    return { service: moduleRef.get(HiringPublicService), office, storage, data, candidates, chat, job }
}

describe("HiringPublicService job", () => {
    it("returns the public fields and questions without scoring expectations", async () => {
        const { service, office, data, job } = await build()

        const result = await service.job(request)

        expect(result).toEqual({
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
            status: "open",
            closesAt: null,
            company: "Market Shop",
            consentText: "consent-1",
            open: true,
            requirements: {
                skills: ["POS"],
                experienceYears: 1,
                experienceNote: "Retail",
                availability: ["Evenings"],
                mustHave: ["Handle payments"],
                niceToHave: ["Stock shelves"],
            },
            questions: [
                { id: "q-1", text: "Can you use POS?", type: "yesno", required: true, choices: [] },
                { id: "q-2", text: "Choose a shift", type: "choice", required: false, choices: ["Evening"] },
            ],
        })
        expect(result.requirements).not.toBe(job.requirements)
        expect(data.settingsBySlug.mock.calls).toEqual([["shop"]])
        expect(data.jobBySlug.mock.calls).toEqual([["ws-1", "cashier"]])
        expect(office.workspaceName.mock.calls).toEqual([["ws-1"]])
    })

    it.each([
        { status: "paused", channels: ["page"], closesAt: null, open: false },
        { status: "open", channels: ["chat"], closesAt: null, open: false },
        { status: "open", channels: ["page"], closesAt: "2026-10-12T23:59:59.999Z", open: false },
        { status: "open", channels: ["page"], closesAt: "2026-10-13T00:00:00.000Z", open: true },
        { status: "open", channels: ["page"], closesAt: "2026-10-14T00:00:00.000Z", open: true },
    ] satisfies ReadonlyArray<Pick<JobRecord, "status" | "channels" | "closesAt"> & { open: boolean }>)(
        "reports open=$open for status=$status and closesAt=$closesAt",
        async ({ status, channels, closesAt, open }) => {
            const { service } = await build(jobOf({ status, channels, closesAt }))

            expect((await service.job(request)).open).toBe(open)
        },
    )

    it("rejects a missing workspace without looking up a job", async () => {
        const { service, data, office } = await build()
        data.settingsBySlug.mockResolvedValue(undefined)

        await expect(service.job(request)).rejects.toMatchObject({ code: HiringErrorCode.PublicNotFound })

        expect(data.jobBySlug).not.toHaveBeenCalled()
        expect(office.workspaceName).not.toHaveBeenCalled()
    })

    it("rejects a missing job", async () => {
        const { service, data } = await build()
        data.jobBySlug.mockResolvedValue(undefined)

        await expect(service.job(request)).rejects.toMatchObject({ code: HiringErrorCode.PublicNotFound })
    })

    it("rejects a draft job", async () => {
        const { service } = await build(jobOf({ status: "draft" }))

        await expect(service.job(request)).rejects.toMatchObject({ code: HiringErrorCode.PublicNotFound })
    })
})

describe("HiringPublicService", () => {
    describe("createCvUpload", () => {
        it.each(["PDF", "doc", "docx", "jpg", "jpeg", "png"])(
            "creates an upload path for an allowed %s extension",
            async (extension) => {
                const { service, data, storage } = await build()
                const path = `ws-1/job-1/token-1/alice-resume.${extension.toLowerCase()}`

                await expect(
                    service.createCvUpload({ ...request, fileName: `Alice Resume.${extension}` }),
                ).resolves.toEqual({
                    path,
                    token: "upload-1",
                })

                expect(data.newToken.mock.calls).toEqual([[]])
                expect(storage.signedUpload.mock.calls).toEqual([[path]])
            },
        )

        it("uses the fallback name when the file stem has no slug", async () => {
            const { service, storage } = await build()

            await expect(service.createCvUpload({ ...request, fileName: "...PDF" })).resolves.toEqual({
                path: "ws-1/job-1/token-1/cv.pdf",
                token: "upload-1",
            })

            expect(storage.signedUpload.mock.calls).toEqual([["ws-1/job-1/token-1/cv.pdf"]])
        })

        it("limits the file stem to forty characters", async () => {
            const { service } = await build()

            await expect(service.createCvUpload({ ...request, fileName: `${"a".repeat(50)}.pdf` })).resolves.toEqual({
                path: `ws-1/job-1/token-1/${"a".repeat(40)}.pdf`,
                token: "upload-1",
            })
        })

        it.each(["resume", "resume.exe", "resume."])("rejects the unsupported file %s", async (fileName) => {
            const { service, data, storage } = await build()

            await expect(service.createCvUpload({ ...request, fileName })).rejects.toMatchObject({
                code: HiringErrorCode.PublicNotFound,
            })

            expect(data.newToken).not.toHaveBeenCalled()
            expect(storage.signedUpload).not.toHaveBeenCalled()
        })

        it("rejects when the store cannot provide an upload token", async () => {
            const { service, storage } = await build()
            storage.signedUpload.mockResolvedValue(null)

            await expect(service.createCvUpload({ ...request, fileName: "resume.pdf" })).rejects.toMatchObject({
                code: HiringErrorCode.PublicNotFound,
            })
        })
    })
})

describe("HiringPublicService", () => {
    describe("apply", () => {
        it("checks the posting before answering a filled honeypot without storing anything", async () => {
            const { service, data, candidates } = await build()

            await expect(service.apply({ ...application, website: " https://bot.example " })).resolves.toEqual({
                duplicate: false,
            })

            expect(data.settingsBySlug).toHaveBeenCalledWith("shop")
            expect(candidates.submit).not.toHaveBeenCalled()
        })

        it("submits a normal application without optional metadata", async () => {
            const { service, candidates, job } = await build()

            await expect(service.apply(application)).resolves.toEqual({ duplicate: false })

            expect(candidates.submit.mock.calls).toEqual([["ws-1", job, "page", submission, {}]])
        })

        it("accepts an empty honeypot and returns the duplicate outcome", async () => {
            const { service, candidates, job } = await build()
            candidates.submit.mockResolvedValue({ candidateId: "candidate-1", duplicate: true })

            await expect(service.apply({ ...application, website: "   " }, "hash-1")).resolves.toEqual({
                duplicate: true,
            })

            expect(candidates.submit.mock.calls).toEqual([["ws-1", job, "page", submission, { ipHash: "hash-1" }]])
        })

        it("rejects jobs without the public page channel", async () => {
            const { service, candidates } = await build(jobOf({ channels: ["chat"] }))

            await expect(service.apply(application)).rejects.toMatchObject({ code: HiringErrorCode.JobNotOpen })

            expect(candidates.submit).not.toHaveBeenCalled()
        })

        it.each(["other/job-1/cv.pdf", "ws-1/job-2/cv.pdf", "ws-1/job-1/../cv.pdf"])(
            "discards the unsafe CV path %s",
            async (cvPath) => {
                const { service, candidates, job } = await build()

                await expect(service.apply({ ...application, cvPath, cvName: "Resume.pdf" })).resolves.toEqual({
                    duplicate: false,
                })

                expect(candidates.submit.mock.calls).toEqual([["ws-1", job, "page", submission, {}]])
            },
        )
    })
})

describe("HiringPublicService", () => {
    describe("apply", () => {
        it.each([
            ["pdf", "application/pdf"],
            ["doc", "application/msword"],
            ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
            ["jpg", "image/jpeg"],
            ["jpeg", "image/jpeg"],
            ["png", "image/png"],
            ["bin", "application/octet-stream"],
        ])("preserves a scoped CV with its %s media type", async (extension, mime) => {
            const { service, candidates, job } = await build()
            const cvPath = `ws-1/job-1/token-1/resume.${extension.toUpperCase()}`

            await expect(service.apply({ ...application, cvPath, cvName: "Resume" }, "hash-1")).resolves.toEqual({
                duplicate: false,
            })

            expect(candidates.submit.mock.calls).toEqual([
                [
                    "ws-1",
                    job,
                    "page",
                    submission,
                    { ipHash: "hash-1", cv: { path: cvPath, name: "Resume", mime, size: 0 } },
                ],
            ])
        })

        it("defaults an absent CV name", async () => {
            const { service, candidates, job } = await build()

            await service.apply({ ...application, cvPath: "ws-1/job-1/token-1/resume.pdf" })

            expect(candidates.submit.mock.calls).toEqual([
                [
                    "ws-1",
                    job,
                    "page",
                    submission,
                    { cv: { path: "ws-1/job-1/token-1/resume.pdf", name: "cv", mime: "application/pdf", size: 0 } },
                ],
            ])
        })

        it("limits a CV name to eighty characters", async () => {
            const { service, candidates, job } = await build()

            await service.apply({ ...application, cvPath: "ws-1/job-1/resume.pdf", cvName: "r".repeat(90) })

            expect(candidates.submit.mock.calls).toEqual([
                [
                    "ws-1",
                    job,
                    "page",
                    submission,
                    { cv: { path: "ws-1/job-1/resume.pdf", name: "r".repeat(80), mime: "application/pdf", size: 0 } },
                ],
            ])
        })
    })
})

describe("HiringPublicService", () => {
    it("hands the shop chat the open jobs and stores the application the chatbot took", async () => {
        const { service } = await build()
        await expect(service.chatBrief("ws-1")).resolves.toBe("[OPEN JOBS] barista")
        await expect(
            service.registerChatApplication("ws-1", "conv-1", {
                job: "barista",
                name: "Lan",
                phone: "0900000000",
                email: "",
                consent: true,
                availability: "evenings",
                answers: [],
            }),
        ).resolves.toEqual({ ok: true, message: "stored", candidateId: "candidate-2" })
    })
})

describe("anonymous posting admission before effects", () => {
    it.each([
        { status: "paused" as const, code: HiringErrorCode.JobNotOpen },
        { channels: ["chat" as const], code: HiringErrorCode.JobNotOpen },
        { closesAt: "2026-10-12T00:00:00.000Z", code: HiringErrorCode.JobExpired },
    ])("refuses both submission doors before any effect (%p)", async ({ code, ...overrides }) => {
        const { service, storage, candidates, data } = await build(jobOf(overrides))
        await expect(service.createCvUpload({ ...request, fileName: "resume.pdf" })).rejects.toMatchObject({ code })
        await expect(service.apply({ ...application, website: "bot" })).rejects.toMatchObject({ code })
        expect(storage.signedUpload).not.toHaveBeenCalled()
        expect(data.newToken).not.toHaveBeenCalled()
        expect(candidates.submit).not.toHaveBeenCalled()
    })
})

describe("posting changes during submission", () => {
    it("refuses an application if page publication is removed after admission", async () => {
        const { service, data, candidates } = await build()
        data.jobBySlug.mockResolvedValueOnce(jobOf()).mockResolvedValueOnce(jobOf({ channels: ["chat"] }))
        await expect(service.apply(application)).rejects.toMatchObject({ code: HiringErrorCode.JobNotOpen })
        expect(candidates.submit).not.toHaveBeenCalled()
    })
})
