import { Test } from "@nestjs/testing"
import { windowOf as realWindowOf } from "./dashboard-period.policy"

/** Noon in Vietnam on 9 November 2026. */
const NOW = new Date("2026-11-09T05:00:00.000Z")

const SUBJECT = Symbol("dashboard-period.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { windowOf: realWindowOf } }],
    }).compile()
    return moduleRef.get<{ windowOf: typeof realWindowOf }>(SUBJECT)
}

describe("windowOf", () => {
    it("today: the one Vietnam day, yesterday before it", async () => {
        const policy = await build()

        const window = policy.windowOf("today", NOW, "Asia/Ho_Chi_Minh")

        expect(window.from.toISOString()).toBe("2026-11-08T17:00:00.000Z")
        expect(window.to.toISOString()).toBe("2026-11-09T17:00:00.000Z")
        expect(window.previousFrom.toISOString()).toBe("2026-11-07T17:00:00.000Z")
    })

    it("seven days: today and the six before, the seven before them as the comparison", async () => {
        const policy = await build()

        const window = policy.windowOf("last_7_days", NOW, "Asia/Ho_Chi_Minh")

        expect(window.from.toISOString()).toBe("2026-11-02T17:00:00.000Z")
        expect(window.to.toISOString()).toBe("2026-11-09T17:00:00.000Z")
        expect(window.previousFrom.toISOString()).toBe("2026-10-26T17:00:00.000Z")
    })

    it("thirty days: today and the twenty-nine before", async () => {
        const policy = await build()

        const window = policy.windowOf("last_30_days", NOW, "Asia/Ho_Chi_Minh")

        expect(window.from.toISOString()).toBe("2026-10-10T17:00:00.000Z")
    })

    it("this month: from the first of the Vietnam month, compared with as many days before it", async () => {
        const policy = await build()

        const window = policy.windowOf("this_month", NOW, "Asia/Ho_Chi_Minh")

        expect(window.from.toISOString()).toBe("2026-10-31T17:00:00.000Z")
        expect(window.previousFrom.toISOString()).toBe("2026-10-22T17:00:00.000Z")
    })
})

describe("the window of a workspace outside Vietnam", () => {
    const NEW_YORK = "America/New_York"

    it("crosses the clock change: seven days ending on 3 November 2026 start at the workspace's own midnight", async () => {
        const policy = await build()

        const window = policy.windowOf("last_7_days", new Date("2026-11-03T17:00:00.000Z"), NEW_YORK)

        expect(window.from.toISOString()).toBe("2026-10-28T04:00:00.000Z")
        expect(window.to.toISOString()).toBe("2026-11-04T05:00:00.000Z")
    })

    it("starts this month at the first of the workspace's month", async () => {
        const policy = await build()

        expect(policy.windowOf("this_month", new Date("2026-11-20T05:00:00.000Z"), NEW_YORK).from.toISOString()).toBe(
            "2026-11-01T04:00:00.000Z",
        )
    })
})
