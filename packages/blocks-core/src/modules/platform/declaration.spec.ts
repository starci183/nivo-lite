import { PLATFORM_FIXTURES } from "./fixtures/platform.fixtures"
import { PLATFORM_MODULE_KEY, platformModule } from "./declaration"

describe("the platform module declaration", () => {
    it("declares the three agent reads, no action and no screen", () => {
        expect(platformModule.key).toBe(PLATFORM_MODULE_KEY)
        expect(platformModule.reads.map((read) => read.id)).toEqual([
            "platform.agent-done",
            "platform.agent-connections",
            "platform.agent-knowledge",
        ])
        expect(platformModule.actions).toEqual([])
        expect(platformModule.specs).toEqual([])
        expect(platformModule.permissions).toEqual(["platform.view"])
    })

    it("has a ready and an empty fixture for every read", () => {
        expect(Object.keys(PLATFORM_FIXTURES.reads)).toEqual(platformModule.reads.map((read) => read.id))
        for (const fixture of Object.values(PLATFORM_FIXTURES.reads)) {
            expect(fixture.ready).toBeDefined()
            expect("empty" in fixture).toBe(true)
        }
    })
})
