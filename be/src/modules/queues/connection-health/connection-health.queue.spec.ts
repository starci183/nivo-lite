import {
    CONNECTION_HEALTH_QUEUE,
    CONNECTION_HEALTH_SCHEDULER,
    isConnectionHealthPayload,
} from "./connection-health.queue"

describe("connection health queue", () => {
    it("checks every fifteen minutes for seventy-two silent hours", () => {
        expect(CONNECTION_HEALTH_QUEUE).toBe("connection_health")
        expect(CONNECTION_HEALTH_SCHEDULER).toEqual({
            queue: "connection_health",
            id: "connection-health-tick",
            everyMs: 900_000,
            payload: { silentAfterHours: 72 },
        })
    })

    it("accepts a numeric silence window and refuses the rest", () => {
        expect(isConnectionHealthPayload({ silentAfterHours: 72 })).toBe(true)
        expect(isConnectionHealthPayload({ silentAfterHours: 0 })).toBe(true)
        expect(isConnectionHealthPayload(null)).toBe(false)
        expect(isConnectionHealthPayload({})).toBe(false)
        expect(isConnectionHealthPayload({ silentAfterHours: "72" })).toBe(false)
    })
})
