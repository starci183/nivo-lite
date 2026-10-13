import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ClaimedJob } from "@modules/platform/jobs"
import { DeliverEventStep } from "../../steps/deliver-event.step"
import { AcceptMetaEventProcessor } from "./accept-meta-event.processor"

const claimedJob: ClaimedJob = {
    jobId: "job-1",
    kind: "meta_inbound",
    fencingToken: 7,
    currentStep: null,
    payload: { connectionId: "connection-1", workspaceId: "workspace-1", event: {} },
}

const build = async () => {
    const deliverEvent = mock<DeliverEventStep>()
    const moduleRef = await Test.createTestingModule({
        providers: [AcceptMetaEventProcessor, { provide: DeliverEventStep, useValue: deliverEvent }],
    }).compile()
    return { processor: moduleRef.get(AcceptMetaEventProcessor), deliverEvent }
}

describe("AcceptMetaEventProcessor", () => {
    it("consumes every job of the meta_inbound queue with the app's concurrency", async () => {
        const { processor } = await build()

        expect(processor.queue).toBe("meta_inbound")
        expect(processor.job).toBeUndefined()
        expect(processor.concurrency).toBeUndefined()
    })

    it("delegates the exact fenced claim to the delivery step", async () => {
        const { processor, deliverEvent } = await build()

        await expect(processor.process(claimedJob)).resolves.toBeUndefined()

        expect(deliverEvent.run.mock.calls).toEqual([[claimedJob]])
        expect(deliverEvent.run.mock.calls[0]?.[0]).toBe(claimedJob)
    })

    it("propagates a step failure to the job runner", async () => {
        const { processor, deliverEvent } = await build()
        const cause = new Error("step failed")
        deliverEvent.run.mockRejectedValue(cause)

        await expect(processor.process(claimedJob)).rejects.toBe(cause)

        expect(deliverEvent.run.mock.calls).toEqual([[claimedJob]])
    })
})
