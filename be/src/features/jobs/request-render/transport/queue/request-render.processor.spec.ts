import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { RequestRenderStep } from "../../steps/request-render.step"
import { RequestRenderProcessor } from "./request-render.processor"

const claimedJob: ClaimedJob = {
    jobId: "job-1",
    kind: "render_request",
    fencingToken: 7,
    currentStep: "request",
    payload: { commandId: "command-1" },
}

const delivery: QueueDelivery = {
    id: "delivery-1",
    queue: "render_request",
    job: "render_request",
    payload: { commandId: "command-1" },
    attempt: 4,
    signal: new AbortController().signal,
}

const build = async () => {
    const request = mock<RequestRenderStep>()
    request.run.mockResolvedValue(undefined)
    request.abandon.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [RequestRenderProcessor, { provide: RequestRenderStep, useValue: request }],
    }).compile()
    return { processor: moduleRef.get(RequestRenderProcessor), request }
}

describe("RequestRenderProcessor", () => {
    it("consumes the render request queue with the default job and concurrency", async () => {
        const { processor } = await build()

        expect([processor.queue, processor.job, processor.concurrency]).toEqual([
            "render_request",
            undefined,
            undefined,
        ])
    })

    it("delegates the complete fenced claim to the step", async () => {
        const { processor, request } = await build()

        await expect(processor.process(claimedJob)).resolves.toBeUndefined()

        expect(request.run.mock.calls).toEqual([[claimedJob]])
        expect(request.run.mock.calls[0]?.[0]).toBe(claimedJob)
        expect(request.abandon).not.toHaveBeenCalled()
    })

    it("awaits and rethrows the step failure", async () => {
        const { processor, request } = await build()
        const failure = new Error("claim fenced out")
        request.run.mockRejectedValue(failure)

        await expect(processor.process(claimedJob)).rejects.toBe(failure)

        expect(request.run.mock.calls).toEqual([[claimedJob]])
        expect(request.abandon).not.toHaveBeenCalled()
    })

    it("abandons exactly the delivery payload when the job ends as failed", async () => {
        const { processor, request } = await build()

        await expect(processor.onFailed(delivery)).resolves.toBeUndefined()

        expect(request.abandon.mock.calls).toEqual([[delivery.payload]])
        expect(request.abandon.mock.calls[0]?.[0]).toBe(delivery.payload)
        expect(request.run).not.toHaveBeenCalled()
    })

    it("awaits and rethrows the abandonment failure", async () => {
        const { processor, request } = await build()
        const failure = new Error("command settlement unavailable")
        request.abandon.mockRejectedValue(failure)

        await expect(processor.onFailed(delivery)).rejects.toBe(failure)

        expect(request.abandon.mock.calls).toEqual([[delivery.payload]])
        expect(request.run).not.toHaveBeenCalled()
    })
})
