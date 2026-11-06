import { Test } from "@nestjs/testing"
import { WORKSPACE_TIME_ZONE, timeZoneOfWorkspace } from "./workspace-time-zone.policy"

const SUBJECT = Symbol("workspace-time-zone.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { timeZoneOfWorkspace } }],
    }).compile()
    return moduleRef.get<{ timeZoneOfWorkspace: typeof timeZoneOfWorkspace }>(SUBJECT)
}

describe("the time zone of a workspace", () => {
    it("is Vietnam's, a zone the platform knows, so the day begins at 17:00 UTC", async () => {
        const policy = await build()
        const zone = policy.timeZoneOfWorkspace("w1")
        expect(zone).toBe(WORKSPACE_TIME_ZONE)
        const hour = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", hourCycle: "h23" }).format(
            new Date("2026-11-05T17:00:00.000Z"),
        )
        expect(hour).toBe("00")
    })
})
