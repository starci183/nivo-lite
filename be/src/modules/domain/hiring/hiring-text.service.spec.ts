import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { HiringTextService } from "./hiring-text.service"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const build = async () => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const moduleRef = await Test.createTestingModule({
        providers: [HiringTextService, { provide: MESSAGE_CATALOG, useValue: catalog }],
    }).compile()
    return { service: moduleRef.get(HiringTextService), catalog }
}

describe("HiringTextService", () => {
    it("reads a catalog line in Vietnamese with default or supplied parameters", async () => {
        const { service, catalog } = await build()

        expect(service.text("hiring.title")).toBe("hiring.title{}")
        expect(service.text("hiring.count", { name: "Alex", count: 2 })).toBe(`hiring.count{"name":"Alex","count":2}`)

        expect(catalog.get.mock.calls).toEqual([
            ["hiring.title", {}, "vi"],
            ["hiring.count", { name: "Alex", count: 2 }, "vi"],
        ])
    })

    it("exposes a policy lookup that passes a copy of its parameters", async () => {
        const { service, catalog } = await build()
        const params = { name: "Alex", amount: 12 }

        expect(service.textOf("hiring.policy", params)).toBe(`hiring.policy{"name":"Alex","amount":12}`)
        expect(service.textOf("hiring.empty", {})).toBe("hiring.empty{}")

        expect(catalog.get.mock.calls).toEqual([
            ["hiring.policy", { name: "Alex", amount: 12 }, "vi"],
            ["hiring.empty", {}, "vi"],
        ])
        expect(catalog.get.mock.calls[0]?.[1]).not.toBe(params)
    })

    it("rounds dong values before applying Vietnamese thousands separators", async () => {
        const { service } = await build()

        expect(service.amount(1234567.5)).toBe("1.234.568")
        expect(service.amount(1234.49)).toBe("1.234")
        expect(service.amount(0)).toBe("0")
        expect(service.amount(-1234.6)).toBe("-1.235")
    })

    it("formats a date and an ISO string with the Vietnam weekday and clock", async () => {
        const { service, catalog } = await build()

        expect(service.when(new Date("2026-10-12T17:05:00.000Z"))).toBe(
            `hiring.when{"weekday":"hiring.weekday.2{}","time":"00:05","date":"13/10/2026"}`,
        )
        expect(service.when("2026-10-17T23:04:00.000Z")).toBe(
            `hiring.when{"weekday":"hiring.weekday.0{}","time":"06:04","date":"18/10/2026"}`,
        )

        expect(catalog.get.mock.calls).toEqual([
            ["hiring.weekday.2", {}, "vi"],
            ["hiring.when", { weekday: "hiring.weekday.2{}", time: "00:05", date: "13/10/2026" }, "vi"],
            ["hiring.weekday.0", {}, "vi"],
            ["hiring.when", { weekday: "hiring.weekday.0{}", time: "06:04", date: "18/10/2026" }, "vi"],
        ])
    })
})
