import { Test } from "@nestjs/testing"
import { fold, parseImport, parseWage, POSITION_COLORS } from "./import-text.policy"

const SUBJECT = Symbol("import-text.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { fold, parseImport, parseWage } }],
    }).compile()
    return moduleRef.get<typeof import("./import-text.policy")>(SUBJECT)
}

describe("import text policy", () => {
    it("compares names with lower case, folded accents and single spaces", async () => {
        const policy = await build()

        expect(policy.fold("  \u0110\u1eb7ng\t  \u00c1nh\n ")).toBe("dang anh")
        expect(policy.fold("BARISTA")).toBe("barista")
    })

    it.each([
        ["30k", 30000],
        ["30.000", 30000],
        ["30,000", 30000],
        ["30000", 30000],
        ["30,5k", 30500],
        ["30.1255k", 30126],
        [" 30K VND /h ", 30000],
        ["30000\u0111/gio", 30000],
        ["12.6", 13],
        ["0", 0],
        ["", 0],
        ["-1", null],
        ["Infinity", null],
        ["unknown", null],
    ])("reads wage %s as %s", async (input, expected) => {
        const policy = await build()

        expect(policy.parseWage(input)).toBe(expected)
    })

    it("returns an empty import for empty boxes", async () => {
        const policy = await build()

        expect(policy.parseImport({ positions: "", staff: "", coverage: "" }, [])).toEqual({
            positions: [],
            staff: [],
            blocks: [],
            errors: [],
        })
    })

    it.each([
        ["", "T2, 7-8 Barista 1", "coverage-days", "t2,"],
        ["", ",CN 7-8 Barista 1", "coverage-days", ",cn"],
        ["", "T2-,CN 7-8 Barista 1", "coverage-days", "t2-,cn"],
        ["", "CN-T2 7-8 Barista 1", "coverage-days", "cn-t2"],
        ["", "T2 7h-8 Barista 1", "coverage-format", ""],
        ["", "T2 7:5-8 Barista 1", "coverage-format", ""],
        ["", "T2 NaN-8 Barista 1", "coverage-format", ""],
        ["", "T2 7-24h00 Barista 1", "coverage-times", ""],
        ["|||", "", "staff-format", ""],
        ["No positions;;30k;40", "", "staff-position-missing", "No positions"],
    ])(
        "keeps the original malformed-input result for staff %p and coverage %p",
        async (staff, coverage, code, subject) => {
            const policy = await build()

            expect(policy.parseImport({ positions: "", staff, coverage }, ["Barista"])).toEqual({
                positions: [],
                staff: [],
                blocks: [],
                errors: [{ code, line: 1, subject }],
            })
        },
    )

    it("keeps missing optional staff fields and coverage ideals at their original defaults", async () => {
        const policy = await build()

        expect(
            policy.parseImport({ positions: "", staff: "Lan;Barista", coverage: "T2 0-1 Barista 0" }, ["Barista"]),
        ).toEqual({
            positions: [],
            staff: [{ name: "Lan", positions: ["Barista"], wage: 0, maxWeek: null }],
            blocks: [{ weekday: 0, start: "00:00", end: "01:00", position: "Barista", min: 0, ideal: 0, peak: false }],
            errors: [],
        })
    })
})

describe("import text policy", () => {
    it("keeps repeated positions and ignores staff fields after weekly hours", async () => {
        const policy = await build()

        expect(
            policy.parseImport(
                { positions: "", staff: "Lan;barista, BARISTA;30k;40;ignored|extra", coverage: "CN 7–8 Barista 1–2" },
                ["Barista", "BARISTA"],
            ),
        ).toEqual({
            positions: [],
            staff: [{ name: "Lan", positions: ["Barista", "Barista"], wage: 30000, maxWeek: 40 }],
            blocks: [{ weekday: 6, start: "07:00", end: "08:00", position: "Barista", min: 1, ideal: 2, peak: false }],
            errors: [],
        })
    })

    it("deduplicates new positions and canonicalises known staff positions", async () => {
        const policy = await build()

        expect(
            policy.parseImport(
                {
                    positions: " Cashier, cashier; Runner\n\nRUNNER ",
                    staff: "\n Alex; barista, CASHIER; 30k; 40\nSam|runner||\n Jo\tBarista\t30.000\t37,5 ",
                    coverage: "",
                },
                ["Barista"],
            ),
        ).toEqual({
            positions: ["Cashier", "Runner"],
            staff: [
                { name: "Alex", positions: ["Barista", "Cashier"], wage: 30000, maxWeek: 40 },
                { name: "Sam", positions: ["Runner"], wage: 0, maxWeek: null },
                { name: "Jo", positions: ["Barista"], wage: 30000, maxWeek: 37.5 },
            ],
            blocks: [],
            errors: [],
        })
    })
})

describe("import text policy", () => {
    it("keeps the original line numbers for every staff error", async () => {
        const policy = await build()

        expect(
            policy.parseImport(
                {
                    positions: "",
                    staff: [
                        "",
                        "Alex",
                        ";Barista",
                        "Sam; , ;30k",
                        "Jo;Runner, Cashier;30k",
                        "Lee;Barista;unknown",
                        "Max;Barista;30k;unknown",
                        "Min;Barista;30k;0",
                        "Pat;Barista;30k;-1",
                        "Chris;Barista;30k;101",
                        "Valid;Barista",
                        "Limit;Barista;0;100",
                    ].join("\n"),
                    coverage: "",
                },
                ["Barista"],
            ),
        ).toEqual({
            positions: [],
            staff: [
                { name: "Valid", positions: ["Barista"], wage: 0, maxWeek: null },
                { name: "Limit", positions: ["Barista"], wage: 0, maxWeek: 100 },
            ],
            blocks: [],
            errors: [
                { code: "staff-format", line: 2, subject: "" },
                { code: "staff-format", line: 3, subject: "" },
                { code: "staff-position-missing", line: 4, subject: "Sam" },
                { code: "staff-position-unknown", line: 5, subject: "Runner, Cashier" },
                { code: "staff-wage", line: 6, subject: "Lee" },
                { code: "staff-hours", line: 7, subject: "Max" },
                { code: "staff-hours", line: 8, subject: "Min" },
                { code: "staff-hours", line: 9, subject: "Pat" },
                { code: "staff-hours", line: 10, subject: "Chris" },
            ],
        })
    })
})

describe("import text policy", () => {
    it("expands ranges and sorted day lists and reads clocks and peak coverage", async () => {
        const policy = await build()

        expect(
            policy.parseImport(
                {
                    positions: "",
                    staff: "",
                    coverage: [
                        "T2-T4 7-11 barista 1-2 peak",
                        "CN,T4,T2,T4 7h30-09:45 Cashier 2",
                        "T7-CN 00:00-23:59 Barista 0-3 cao diem",
                    ].join("\n"),
                },
                ["Barista", "Cashier"],
            ),
        ).toEqual({
            positions: [],
            staff: [],
            blocks: [
                { weekday: 0, start: "07:00", end: "11:00", position: "Barista", min: 1, ideal: 2, peak: true },
                { weekday: 1, start: "07:00", end: "11:00", position: "Barista", min: 1, ideal: 2, peak: true },
                { weekday: 2, start: "07:00", end: "11:00", position: "Barista", min: 1, ideal: 2, peak: true },
                { weekday: 0, start: "07:30", end: "09:45", position: "Cashier", min: 2, ideal: 2, peak: false },
                { weekday: 2, start: "07:30", end: "09:45", position: "Cashier", min: 2, ideal: 2, peak: false },
                { weekday: 6, start: "07:30", end: "09:45", position: "Cashier", min: 2, ideal: 2, peak: false },
                { weekday: 5, start: "00:00", end: "23:59", position: "Barista", min: 0, ideal: 3, peak: true },
                { weekday: 6, start: "00:00", end: "23:59", position: "Barista", min: 0, ideal: 3, peak: true },
            ],
            errors: [],
        })
    })

    it.each(["moi ngay", "hang ngay", "T2-CN", "T2-T7-CN"])("expands %s into the whole week", async (days) => {
        const policy = await build()

        expect(
            policy.parseImport({ positions: "", staff: "", coverage: `${days} 7-8 Barista 1` }, ["Barista"]),
        ).toEqual({
            positions: [],
            staff: [],
            blocks: [
                { weekday: 0, start: "07:00", end: "08:00", position: "Barista", min: 1, ideal: 1, peak: false },
                { weekday: 1, start: "07:00", end: "08:00", position: "Barista", min: 1, ideal: 1, peak: false },
                { weekday: 2, start: "07:00", end: "08:00", position: "Barista", min: 1, ideal: 1, peak: false },
                { weekday: 3, start: "07:00", end: "08:00", position: "Barista", min: 1, ideal: 1, peak: false },
                { weekday: 4, start: "07:00", end: "08:00", position: "Barista", min: 1, ideal: 1, peak: false },
                { weekday: 5, start: "07:00", end: "08:00", position: "Barista", min: 1, ideal: 1, peak: false },
                { weekday: 6, start: "07:00", end: "08:00", position: "Barista", min: 1, ideal: 1, peak: false },
            ],
            errors: [],
        })
    })
})

describe("import text policy", () => {
    it("keeps the original line numbers for every coverage error", async () => {
        const policy = await build()

        expect(
            policy.parseImport(
                {
                    positions: "",
                    staff: "",
                    coverage: [
                        "",
                        "invalid",
                        "T8 7-8 Barista 1",
                        "T4-T2 7-8 Barista 1",
                        "T2 24-25 Barista 1",
                        "T2 7:60-9 Barista 1",
                        "T2 7-24 Barista 1",
                        "T2 8-8 Barista 1",
                        "T2 9-8 Barista 1",
                        "T2 7-8 Runner 1",
                        "T2 7-8 Barista 3-2",
                    ].join("\n"),
                },
                ["Barista"],
            ),
        ).toEqual({
            positions: [],
            staff: [],
            blocks: [],
            errors: [
                { code: "coverage-format", line: 2, subject: "" },
                { code: "coverage-days", line: 3, subject: "t8" },
                { code: "coverage-days", line: 4, subject: "t4-t2" },
                { code: "coverage-times", line: 5, subject: "" },
                { code: "coverage-times", line: 6, subject: "" },
                { code: "coverage-times", line: 7, subject: "" },
                { code: "coverage-times", line: 8, subject: "" },
                { code: "coverage-times", line: 9, subject: "" },
                { code: "coverage-position", line: 10, subject: "runner" },
                { code: "coverage-ideal", line: 11, subject: "" },
            ],
        })
    })

    it("uses the setup position colour cycle", () => {
        expect(POSITION_COLORS).toEqual([
            "#2f6fed",
            "#e8590c",
            "#2b8a3e",
            "#ae3ec9",
            "#0c8599",
            "#c2255c",
            "#5c7cfa",
            "#e67700",
        ])
    })
})

describe("import text policy", () => {
    it("prefers the existing accented position spelling and rejects empty tokens in day lists", async () => {
        const policy = await build()

        expect(
            policy.parseImport(
                {
                    positions: "B\u00c1N H\u00c0NG",
                    staff: "Lan; ban hang;12,5k;7,5",
                    coverage: "T6,T2-T3 7h30-8:45 ban hang 1 cao \u0111i\u1ec3m\nT2,,CN 7-8 ban hang 1",
                },
                ["B\u00e1n h\u00e0ng"],
            ),
        ).toEqual({
            positions: ["B\u00c1N H\u00c0NG"],
            staff: [{ name: "Lan", positions: ["B\u00e1n h\u00e0ng"], wage: 12500, maxWeek: 7.5 }],
            blocks: [
                {
                    weekday: 0,
                    start: "07:30",
                    end: "08:45",
                    position: "B\u00e1n h\u00e0ng",
                    min: 1,
                    ideal: 1,
                    peak: true,
                },
                {
                    weekday: 1,
                    start: "07:30",
                    end: "08:45",
                    position: "B\u00e1n h\u00e0ng",
                    min: 1,
                    ideal: 1,
                    peak: true,
                },
                {
                    weekday: 4,
                    start: "07:30",
                    end: "08:45",
                    position: "B\u00e1n h\u00e0ng",
                    min: 1,
                    ideal: 1,
                    peak: true,
                },
            ],
            errors: [{ code: "coverage-days", line: 2, subject: "t2,,cn" }],
        })
    })
})
