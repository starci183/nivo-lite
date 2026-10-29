import { DEFAULT_CONFIG } from "./loyalty-config.policy"
import { toProgram } from "./program.mapper"
import type { ProgramFields } from "./program.mapper"

const programRow = (config: unknown): ProgramFields => ({
    workspaceId: "w-1",
    slug: "main",
    name: "Loyalty",
    enabled: true,
    config: config as ProgramFields["config"],
    createdAt: new Date("2025-01-02T03:04:05.000Z"),
})

describe("toProgram", () => {
    it("maps the columns and resolves an empty config to the defaults", () => {
        expect(toProgram(programRow({}))).toEqual({
            workspaceId: "w-1",
            slug: "main",
            name: "Loyalty",
            enabled: true,
            config: DEFAULT_CONFIG,
            createdAt: "2025-01-02T03:04:05.000Z",
        })
    })

    it("resolves the saved rules over the defaults", () => {
        const program = toProgram(programRow({ earn: { perVisit: 5 }, expiry: { months: 6 } }))

        expect(program.config.earn.perVisit).toBe(5)
        expect(program.config.expiry.months).toBe(6)
        expect(program.config.expiry.warnDays).toBe(DEFAULT_CONFIG.expiry.warnDays)
    })
})
