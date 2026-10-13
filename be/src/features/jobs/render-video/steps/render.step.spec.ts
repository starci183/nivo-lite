import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { VideoRenderService } from "@modules/domain/video"
import { JOB_CLAIMS } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { RenderStep } from "./render.step"
jest.mock("@modules/integrations/supabase", () => ({ InjectSupabaseAdminClient: () => () => undefined }))

const jobOf = builder<ClaimedJob>({
    jobId: "video-job-1",
    kind: "video_render",
    fencingToken: 7,
    currentStep: null,
    payload: { workspaceId: "workspace-1", renderId: "render-1" },
})

const build = async () => {
    const video = mock<VideoRenderService>()
    const claims = mock<JobClaims>()
    video.render.mockResolvedValue(undefined)
    claims.advance.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            RenderStep,
            { provide: VideoRenderService, useValue: video },
            { provide: JOB_CLAIMS, useValue: claims },
        ],
    }).compile()
    return { step: moduleRef.get(RenderStep), video, claims }
}

describe("RenderStep", () => {
    it("waits for the fenced render write before rendering the video", async () => {
        const { step, video, claims } = await build()
        const job = jobOf()
        let release: () => void = () => undefined
        const advanced = new Promise<void>((resolve) => {
            release = resolve
        })
        claims.advance.mockReturnValue(advanced)

        const running = step.run(job)

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "video-job-1", expectedFencingToken: 7, step: "render" }],
        ])
        expect(video.render.mock.calls).toEqual([])
        release()
        await expect(running).resolves.toBeUndefined()
        expect(video.render.mock.calls).toEqual([[job.payload]])
        expect(video.render.mock.calls[0]?.[0]).toBe(job.payload)
        expect(claims.complete.mock.calls).toEqual([])
        expect(claims.fail.mock.calls).toEqual([])
    })

    it.each([{}, { renderId: 42 }])(
        "passes an invalid payload to the video capability unchanged: %j",
        async (payload) => {
            const { step, video, claims } = await build()

            await expect(step.run(jobOf({ payload }))).resolves.toBeUndefined()

            expect(claims.advance.mock.calls).toEqual([
                [{ jobId: "video-job-1", expectedFencingToken: 7, step: "render" }],
            ])
            expect(video.render.mock.calls).toEqual([[payload]])
            expect(video.render.mock.calls[0]?.[0]).toBe(payload)
        },
    )

    it("propagates a stale-token refusal before rendering any video", async () => {
        const { step, video, claims } = await build()
        const refusal = new Error("JOBS_FENCED_OUT")
        claims.advance.mockRejectedValue(refusal)

        await expect(step.run(jobOf())).rejects.toBe(refusal)

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "video-job-1", expectedFencingToken: 7, step: "render" }],
        ])
        expect(video.render.mock.calls).toEqual([])
        expect(claims.complete.mock.calls).toEqual([])
        expect(claims.fail.mock.calls).toEqual([])
    })

    it("propagates the render failure after recording the fenced step", async () => {
        const { step, video, claims } = await build()
        const job = jobOf()
        const failure = new Error("video renderer unavailable")
        video.render.mockRejectedValue(failure)

        await expect(step.run(job)).rejects.toBe(failure)

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "video-job-1", expectedFencingToken: 7, step: "render" }],
        ])
        expect(video.render.mock.calls).toEqual([[job.payload]])
        expect(claims.complete.mock.calls).toEqual([])
        expect(claims.fail.mock.calls).toEqual([])
    })
})
