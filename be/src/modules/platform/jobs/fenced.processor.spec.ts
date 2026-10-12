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

describe("FencedProcessor", () => {
    it("lets a processor declare its queue and process a claimed job", async () => {
        const processor = new MailProcessor()

        await processor.process(claimedJob)

        expect(processor.queue).toBe("mail")
        expect(processor.processed).toEqual([claimedJob])
    })

    it("takes every job of its queue and the app default concurrency unless it says otherwise", () => {
        const processor = new MailProcessor()

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

        await expect(new MailProcessor().onFailed(delivery, new Error("gave up"))).resolves.toBeUndefined()
    })
})
