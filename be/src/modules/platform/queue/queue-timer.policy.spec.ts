import { startLocalInterval, startLocalTimeout } from "./queue-timer.policy"

describe("process-local queue timers", () => {
    beforeEach(() => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it("runs a timeout once, only after its full duration", () => {
        let completed = 0
        startLocalTimeout(2000, () => {
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

    it("cancels a timeout before its callback can run", () => {
        let completed = 0
        const timer = startLocalTimeout(2000, () => {
            completed += 1
        })

        jest.advanceTimersByTime(1999)
        timer.cancel()
        timer.cancel()

        expect(jest.getTimerCount()).toBe(0)
        jest.advanceTimersByTime(2000)
        expect(completed).toBe(0)
    })

    it("runs an interval at each full duration", () => {
        let completed = 0
        const timer = startLocalInterval(1000, () => {
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

    it("cancels future interval callbacks and releases its timer", () => {
        let completed = 0
        const timer = startLocalInterval(1000, () => {
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
