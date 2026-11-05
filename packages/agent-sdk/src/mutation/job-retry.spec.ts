import { JobRetry, retryJob } from "./job-retry"

describe("JobRetry", () => {
    it("carries a stable code, the job it is about and the status the queue reads as transient", () => {
        const retry = new JobRetry("chatbot.deliver-reply")
        expect(retry).toBeInstanceOf(Error)
        expect(retry).toMatchObject({
            code: "JOB_RETRY",
            at: "chatbot.deliver-reply",
            status: 503,
            name: "JobRetry",
            message: "JOB_RETRY: chatbot.deliver-reply",
        })
    })
})

describe("retryJob", () => {
    it("throws the retry of the job named", () => {
        expect(() => retryJob("chatbot.deliver-reply")).toThrow(JobRetry)
    })
})
