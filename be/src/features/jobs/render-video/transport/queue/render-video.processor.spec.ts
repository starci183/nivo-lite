import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { ClaimedJob } from "@modules/platform/jobs"
import { RenderStep } from "../../steps/render.step"
import { RenderVideoProcessor } from "./render-video.processor"
jest.mock("@modules/integrations/supabase", () => ({ InjectSupabaseAdminClient: () => () => undefined }))

const jobOf = builder<ClaimedJob>({
    jobId: "video-job-1",
    kind: "video_render",
    fencingToken: 7,
    currentStep: "render",
    payload: { workspaceId: "workspace-1", renderId: "render-1" },
})

const build = async () => {
    const render = mock<RenderStep>()
    render.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [RenderVideoProcessor, { provide: RenderStep, useValue: render }],
    }).compile()
    return { processor: moduleRef.get(RenderVideoProcessor), render }
}

describe("RenderVideoProcessor", () => {
    it("consumes the video render queue with the default job and concurrency", async () => {
        const { processor } = await build()

        expect([processor.queue, processor.job, processor.concurrency]).toEqual(["video_render", undefined, undefined])
    })

    it("passes the complete fenced claim to the step and awaits its completion", async () => {
        const { processor, render } = await build()
        const job = jobOf()
        let release: () => void = () => undefined
        const pending = new Promise<void>((resolve) => {
            release = resolve
        })
        render.run.mockReturnValue(pending)
        let finished = false

        const processing = processor.process(job).then(() => {
            finished = true
        })
        await Promise.resolve()

        expect(render.run.mock.calls).toEqual([[job]])
        expect(render.run.mock.calls[0]?.[0]).toBe(job)
        expect(finished).toBe(false)
        release()
        await expect(processing).resolves.toBeUndefined()
        expect(finished).toBe(true)
        expect(render.run.mock.calls).toEqual([[job]])
    })

    it("propagates the stale-token refusal from the step unchanged", async () => {
        const { processor, render } = await build()
        const job = jobOf()
        const refusal = new Error("JOBS_FENCED_OUT")
        render.run.mockRejectedValue(refusal)

        await expect(processor.process(job)).rejects.toBe(refusal)

        expect(render.run.mock.calls).toEqual([[job]])
    })

    it("propagates a render failure so the queue can retry the delivery", async () => {
        const { processor, render } = await build()
        const job = jobOf()
        const failure = new Error("video renderer unavailable")
        render.run.mockRejectedValue(failure)

        await expect(processor.process(job)).rejects.toBe(failure)

        expect(render.run.mock.calls).toEqual([[job]])
    })
})
