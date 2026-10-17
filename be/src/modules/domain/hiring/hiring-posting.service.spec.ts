import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { HiringErrorCode } from "./errors/hiring.error"
import type { HiringSettings, JobRecord } from "./hiring.contracts"
import type { PostingCredentialRequest } from "./hiring-posting.contracts"
import { HiringDataService } from "./hiring-data.service"
import { HiringPostingService } from "./hiring-posting.service"

const input = { ws: "shop", job: "cashier" }
const now = "2026-10-13T00:00:00.000Z"

const build = async (request: PostingCredentialRequest = input) => {
    const settings = mock<HiringSettings>({ workspaceId: "ws-1", publicSlug: "shop" })
    const job = mock<JobRecord>({
        id: "job-1",
        workspaceId: "ws-1",
        slug: "cashier",
        status: "open",
        channels: ["page"],
        closesAt: null,
    })
    const data = mock<HiringDataService>()
    data.settingsBySlug.mockResolvedValue(settings)
    data.jobBySlug.mockResolvedValue(job)
    const moduleRef = await Test.createTestingModule({
        providers: [
            HiringPostingService,
            { provide: HiringDataService, useValue: data },
            { provide: CLOCK, useValue: new FakeClock(now) },
        ],
    }).compile()
    await moduleRef.init()
    return { service: moduleRef.get(HiringPostingService), request, data, job, settings }
}

describe("HiringPostingService", () => {
    it.each([null, now, "2026-10-14T00:00:00.000Z"])(
        "admits an open page posting with closing date %s",
        async (closesAt) => {
            const { service, request, data, job } = await build()
            data.jobBySlug.mockResolvedValue({ ...job, closesAt })

            await expect(service.requireOpen(request)).resolves.toEqual({
                kind: "posting",
                subject: "job-1",
                workspaceId: "ws-1",
            })
            expect(data.settingsBySlug).toHaveBeenCalledWith("shop")
            expect(data.jobBySlug).toHaveBeenCalledWith("ws-1", "cashier")
        },
    )

    it.each([
        {},
        { ws: null, job: null },
        { ws: undefined, job: undefined },
        { ...input, ws: 1 },
        { ...input, ws: "" },
        { ...input, ws: "x".repeat(81) },
        { ...input, job: 1 },
        { ...input, job: "" },
        { ...input, job: "x".repeat(121) },
    ])("refuses malformed capabilities before lookup (%p)", async (args) => {
        const { service, request, data } = await build(args)

        await expect(service.requireOpen(request)).rejects.toMatchObject({ code: HiringErrorCode.PublicNotFound })
        expect(data.settingsBySlug).not.toHaveBeenCalled()
        expect(data.jobBySlug).not.toHaveBeenCalled()
    })
})

describe("HiringPostingService posting state", () => {
    it.each([undefined, mock<HiringSettings>({ workspaceId: "ws-1", publicSlug: "other" })])(
        "refuses a missing or mismatched workspace (%p)",
        async (settings) => {
            const { service, request, data } = await build()
            data.settingsBySlug.mockResolvedValue(settings)

            await expect(service.requireOpen(request)).rejects.toMatchObject({ code: HiringErrorCode.PublicNotFound })
            expect(data.jobBySlug).not.toHaveBeenCalled()
        },
    )

    it("refuses a missing job", async () => {
        const { service, request, data } = await build()
        data.jobBySlug.mockResolvedValue(undefined)
        await expect(service.requireOpen(request)).rejects.toMatchObject({ code: HiringErrorCode.PublicNotFound })
    })

    it.each<Partial<JobRecord>>([{ workspaceId: "other" }, { slug: "other" }, { status: "draft" }])(
        "refuses a foreign or unpublished posting (%p)",
        async (overrides) => {
            const { service, request, data, job } = await build()
            data.jobBySlug.mockResolvedValue({ ...job, ...overrides })
            await expect(service.requireOpen(request)).rejects.toMatchObject({ code: HiringErrorCode.PublicNotFound })
        },
    )

    it.each<Partial<JobRecord>>([{ status: "paused" }, { status: "closed" }, { channels: ["chat"] }])(
        "refuses a posting not accepting page submissions (%p)",
        async (overrides) => {
            const { service, request, data, job } = await build()
            data.jobBySlug.mockResolvedValue({ ...job, ...overrides })
            await expect(service.requireOpen(request)).rejects.toMatchObject({ code: HiringErrorCode.JobNotOpen })
        },
    )

    it.each(["2026-10-12T23:59:59.999Z", "invalid-date"])(
        "refuses an expired or invalid closing date (%s)",
        async (closesAt) => {
            const { service, request, data, job } = await build()
            data.jobBySlug.mockResolvedValue({ ...job, closesAt })
            await expect(service.requireOpen(request)).rejects.toMatchObject({ code: HiringErrorCode.JobExpired })
        },
    )

    it("propagates persistence failure", async () => {
        const { service, request, data } = await build()
        const failure = new Error("database unavailable")
        data.settingsBySlug.mockRejectedValue(failure)
        await expect(service.requireOpen(request)).rejects.toBe(failure)
    })
})
