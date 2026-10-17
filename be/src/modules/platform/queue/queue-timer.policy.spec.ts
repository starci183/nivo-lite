import type * as SubjectModule from "./queue-timer.policy"
import { Test } from "@nestjs/testing"
import { startLocalInterval, startLocalTimeout } from "./queue-timer.policy"

const SUBJECT = Symbol("queue-timer.policy")
type Subject = Pick<typeof SubjectModule, "startLocalTimeout" | "startLocalInterval">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { startLocalTimeout, startLocalInterval } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("process-local queue timers", () => {
    beforeEach(() => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it("runs a timeout once, only after its full duration", async () => {
        const subject = await buildSubject()

        let completed = 0
        subject.startLocalTimeout(2000, () => {
            completed += 1
        })

        jest.advanceTimersByTime(1999)
        expect(completed).toBe(0)
        expect(jest.getTimerCount()).toBe(1)

        jest.advanceTimersByTime(1)
        expect(completed).toBe(1)
        expect(jest.getTimerCount()).toBe(0)

        jest.advanceTimersByTime(2000)
        expect(completed).toBe(1)
    })

    it("cancels a timeout before its callback can run", async () => {
        const subject = await buildSubject()

        let completed = 0
        const timer = subject.startLocalTimeout(2000, () => {
            completed += 1
        })

        jest.advanceTimersByTime(1999)
        timer.cancel()
        timer.cancel()

        expect(jest.getTimerCount()).toBe(0)
        jest.advanceTimersByTime(2000)
        expect(completed).toBe(0)
    })

    it("runs an interval at each full duration", async () => {
        const subject = await buildSubject()

        let completed = 0
        const timer = subject.startLocalInterval(1000, () => {
            completed += 1
        })

        jest.advanceTimersByTime(999)
        expect(completed).toBe(0)

        jest.advanceTimersByTime(1)
        expect(completed).toBe(1)

        jest.advanceTimersByTime(2000)
        expect(completed).toBe(3)
        expect(jest.getTimerCount()).toBe(1)
        timer.cancel()
    })
})

describe("process-local queue timers", () => {
    beforeEach(() => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it("cancels future interval callbacks and releases its timer", async () => {
        const subject = await buildSubject()

        let completed = 0
        const timer = subject.startLocalInterval(1000, () => {
            completed += 1
        })

        jest.advanceTimersByTime(1000)
        timer.cancel()
        timer.cancel()

        expect(jest.getTimerCount()).toBe(0)
        jest.advanceTimersByTime(3000)
        expect(completed).toBe(1)
    })
})
