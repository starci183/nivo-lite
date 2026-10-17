import { Test } from "@nestjs/testing"
import type { ClaimedJob } from "./jobs.contracts"
import { FencedProcessor } from "./fenced.processor"

const claimedJob: ClaimedJob = {
    jobId: "job-1",
    kind: "mail",
    fencingToken: 3,
    currentStep: null,
    payload: { messageId: "message-1" },
}

class MailProcessor extends FencedProcessor {
    readonly queue = "mail"
    readonly processed: Array<ClaimedJob> = []

    process(job: ClaimedJob): Promise<void> {
        this.processed.push(job)
        return Promise.resolve()
    }
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: FencedProcessor, useClass: MailProcessor }],
    }).compile()
    return moduleRef.get<MailProcessor>(FencedProcessor)
}

describe("FencedProcessor", () => {
    it("lets a processor declare its queue and process a claimed job", async () => {
        const processor = await build()

        await processor.process(claimedJob)

        expect(processor.queue).toBe("mail")
        expect(processor.processed).toEqual([claimedJob])
    })

    it("takes every job of its queue and the app default concurrency unless it says otherwise", async () => {
        const processor = await build()

        expect([processor.job, processor.concurrency]).toEqual([undefined, undefined])
    })

    it("does nothing when a job ends as failed, unless the processor writes the failure", async () => {
        const delivery = {
            id: "k-1",
            queue: "mail",
            job: "mail",
            payload: {},
            attempt: 4,
            signal: new AbortController().signal,
        }

        const processor = await build()
        await expect(processor.onFailed(delivery, new Error("gave up"))).resolves.toBeUndefined()
    })
})
