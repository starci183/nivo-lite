import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { CalendarRegistryService } from "./calendar-registry.service"
import type { CalendarPort } from "./calendar-ports.contracts"

describe("CalendarRegistryService", () => {
    const build = async () => {
        const moduleRef = await Test.createTestingModule({ providers: [CalendarRegistryService] }).compile()
        return moduleRef.get(CalendarRegistryService)
    }

    it("starts with no provider and answers undefined for a key nobody registered", async () => {
        const registry = await build()

        expect(registry.providers()).toEqual([])
        expect(registry.has("google_calendar")).toBe(false)
        expect(registry.liveOf("google_calendar")).toBeUndefined()
    })

    it("finds a registered provider by its key, and a second registration under the key replaces the first", async () => {
        const registry = await build()
        const first = mock<CalendarPort>({ provider: "google_calendar" })
        const second = mock<CalendarPort>({ provider: "google_calendar" })

        registry.register(first)
        expect(registry.liveOf("google_calendar")).toBe(first)
        registry.register(second)

        expect(registry.liveOf("google_calendar")).toBe(second)
        expect(registry.providers()).toHaveLength(1)
        expect(registry.liveOf(registry.providers()[0] ?? "")).toBe(second)
    })
})
