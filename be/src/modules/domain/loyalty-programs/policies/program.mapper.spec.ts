import { Test } from "@nestjs/testing"
import { DEFAULT_CONFIG } from "./loyalty-config.policy"
import { firstProgramRow, toProgram } from "./program.mapper"
import type { ProgramFields } from "./program.mapper"

const SUBJECT = Symbol("program.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { firstProgramRow, toProgram } }],
    }).compile()
    return moduleRef.get<typeof import("./program.mapper")>(SUBJECT)
}

let subject: Awaited<ReturnType<typeof buildSubject>>

beforeAll(async () => {
    subject = await buildSubject()
})

const programRow = (config: object): ProgramFields => ({
    workspaceId: "w-1",
    slug: "main",
    name: "Loyalty",
    enabled: true,
    config,
    createdAt: new Date("2025-01-02T03:04:05.000Z"),
})

describe("toProgram", () => {
    it("maps the columns and resolves an empty config to the defaults", () => {
        expect(subject.toProgram(programRow({}))).toEqual({
            workspaceId: "w-1",
            slug: "main",
            name: "Loyalty",
            enabled: true,
            config: DEFAULT_CONFIG,
            createdAt: "2025-01-02T03:04:05.000Z",
        })
    })

    it("resolves the saved rules over the defaults", () => {
        const program = subject.toProgram(programRow({ earn: { perVisit: 5 }, expiry: { months: 6 } }))

        expect(program.config.earn.perVisit).toBe(5)
        expect(program.config.expiry.months).toBe(6)
        expect(program.config.expiry.warnDays).toBe(DEFAULT_CONFIG.expiry.warnDays)
    })
})

describe("firstProgramRow", () => {
    it("answers the first row when it carries every programme column", () => {
        const row = programRow({})

        expect(subject.firstProgramRow([row])).toBe(row)
    })

    it("answers undefined for a non-array answer, no rows, or a malformed first row", () => {
        const row = programRow({})
        const malformed: ReadonlyArray<unknown> = [
            undefined,
            [],
            [null],
            [{ ...row, workspaceId: 1 }],
            [{ ...row, slug: 1 }],
            [{ ...row, name: 1 }],
            [{ ...row, enabled: "yes" }],
            [{ ...row, config: null }],
            [{ ...row, createdAt: "2025-01-02" }],
        ]

        expect(malformed.map((raw) => subject.firstProgramRow(raw))).toEqual(malformed.map(() => undefined))
    })
})
