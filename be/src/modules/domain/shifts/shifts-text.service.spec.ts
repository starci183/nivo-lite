import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ShiftsTextService } from "./shifts-text.service"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const build = async () => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const moduleRef = await Test.createTestingModule({
        providers: [ShiftsTextService, { provide: MESSAGE_CATALOG, useValue: catalog }],
    }).compile()
    return { service: moduleRef.get(ShiftsTextService), catalog }
}

describe("ShiftsTextService", () => {
    it("reads a catalog line in Vietnamese with default or supplied values", async () => {
        const { service, catalog } = await build()

        expect(service.text("shifts.title")).toBe("shifts.title{}")
        expect(service.text("shifts.count", { name: "Alex", count: 2 })).toBe(
            text("shifts.count", { name: "Alex", count: 2 }),
        )

        expect(catalog.get).toHaveBeenNthCalledWith(1, "shifts.title", {}, "vi")
        expect(catalog.get).toHaveBeenNthCalledWith(2, "shifts.count", { name: "Alex", count: 2 }, "vi")
    })

    it("labels a day and a week using all seven catalog weekday names", async () => {
        const { service, catalog } = await build()

        expect(service.day("2026-10-15")).toBe("shifts.weekday.3{} 15/10")
        expect(service.week("2026-10-12")).toBe("12/10 - 18/10")

        expect(catalog.get.mock.calls).toEqual([
            ["shifts.weekday.0", {}, "vi"],
            ["shifts.weekday.1", {}, "vi"],
            ["shifts.weekday.2", {}, "vi"],
            ["shifts.weekday.3", {}, "vi"],
            ["shifts.weekday.4", {}, "vi"],
            ["shifts.weekday.5", {}, "vi"],
            ["shifts.weekday.6", {}, "vi"],
            ["shifts.weekday.0", {}, "vi"],
            ["shifts.weekday.1", {}, "vi"],
            ["shifts.weekday.2", {}, "vi"],
            ["shifts.weekday.3", {}, "vi"],
            ["shifts.weekday.4", {}, "vi"],
            ["shifts.weekday.5", {}, "vi"],
            ["shifts.weekday.6", {}, "vi"],
        ])
    })

    it("writes a schedule line with the day, hours and position", async () => {
        const { service } = await build()

        expect(
            service.line(
                { positions: [{ id: "position-1", name: "Cashier", color: "#123456" }] },
                {
                    id: "shift-1",
                    date: "2026-10-12",
                    start: "08:00",
                    end: "12:00",
                    positionId: "position-1",
                    staffId: "staff-1",
                    status: "draft",
                },
            ),
        ).toBe("shifts.weekday.0{} 12/10 08:00-12:00 Cashier")
    })

    it("writes one day for equal endpoints or a catalog range for different days", async () => {
        const { service, catalog } = await build()

        expect(service.range("2026-10-12", "2026-10-12")).toBe("shifts.weekday.0{} 12/10")
        expect(service.range("2026-10-12", "2026-10-14")).toBe(
            text("shifts.rangeDash", { from: "shifts.weekday.0{} 12/10", to: "shifts.weekday.2{} 14/10" }),
        )

        expect(catalog.get).toHaveBeenLastCalledWith(
            "shifts.rangeDash",
            { from: "shifts.weekday.0{} 12/10", to: "shifts.weekday.2{} 14/10" },
            "vi",
        )
    })

    it("renders each rule finding with its own values and preserves their order", async () => {
        const { service, catalog } = await build()

        expect(service.findings([])).toEqual([])
        expect(
            service.findings([
                { code: "notice", params: { hours: 12 } },
                { code: "position", params: { name: "Alex", position: "Cashier" } },
            ]),
        ).toEqual([
            text("shifts.finding.notice", { hours: 12 }),
            text("shifts.finding.position", { name: "Alex", position: "Cashier" }),
        ])

        expect(catalog.get.mock.calls).toEqual([
            ["shifts.finding.notice", { hours: 12 }, "vi"],
            ["shifts.finding.position", { name: "Alex", position: "Cashier" }, "vi"],
        ])
    })
})
