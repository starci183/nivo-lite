import { Test } from "@nestjs/testing"
import { ProgressThrottlePolicy } from "./progress-throttle.policy"

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [ProgressThrottlePolicy] }).compile()
    return moduleRef.get(ProgressThrottlePolicy)
}

describe("ProgressThrottlePolicy", () => {
    it("lets the first write of a source through and holds the others of the same second", async () => {
        const throttle = await buildSubject()
        expect(throttle.admits("s1", 0)).toBe(true)
        expect(throttle.admits("s1", 400)).toBe(false)
        expect(throttle.admits("s1", 999)).toBe(false)
        expect(throttle.admits("s1", 1000)).toBe(true)
    })

    it("counts a held write from the last write that went out, not from the held one", async () => {
        const throttle = await buildSubject()
        throttle.admits("s1", 0)
        throttle.admits("s1", 900)
        expect(throttle.admits("s1", 1000)).toBe(true)
    })

    it("keeps each source on its own clock", async () => {
        const throttle = await buildSubject()
        throttle.admits("s1", 0)
        expect(throttle.admits("s2", 10)).toBe(true)
    })

    it("lets the next write of a released source through at once", async () => {
        const throttle = await buildSubject()
        throttle.admits("s1", 0)
        throttle.release("s1")
        expect(throttle.admits("s1", 1)).toBe(true)
    })
})
