import { Test } from "@nestjs/testing"
import type { SheetLayout } from "./brain-dossiers.contracts"
import { dossiersOf, layoutOf, statusOf } from "./dossier-sheet.policy"
import { DOSSIER_CHECKLIST_WORDS } from "./messages/dossier-checklist.messages"

const SUBJECT = Symbol("dossier-sheet.policy")
type Subject = { dossiersOf: typeof dossiersOf; layoutOf: typeof layoutOf; statusOf: typeof statusOf }
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { dossiersOf, layoutOf, statusOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const { columns, statuses } = DOSSIER_CHECKLIST_WORDS
const HEADER = [
    columns.ref.toUpperCase(),
    columns.category,
    columns.name,
    columns.status,
    `${columns.existing} already held`,
    `${columns.missing} / to do`,
    `${columns.drafts} / register 22/10/2026`,
]
const SHEET = [
    ["COMPANY - STATUS OF 64 DOSSIERS"],
    [],
    HEADER,
    [
        "1",
        "01. LEGAL FILES",
        "Registration certificate",
        statuses.present,
        "Certificate",
        "Fill the log",
        "01. Log.xlsx",
    ],
    ["", "", "", "", "", "", ""],
    ["02", "01 - LEGAL FILES", "Charter", statuses.partial, "", "  ", ""],
    ["BKS", "05. SUPERVISORS", "Supervisory board file", statuses.missing, "", "", ""],
    ["3", "No number", "Template", statuses.present],
    ["4", "12. FORMS", "Resolution template", `${statuses.template} (used when needed)`],
    ["5", "12. FORMS", "Odd", "Under review"],
    ["6", "12. FORMS", "", statuses.missing],
    ["7", "07.", "No label", statuses.missing],
    ["8", "", "No category", statuses.missing],
    ["9", "12. FORMS", "No status", ""],
]
const FULL_LAYOUT: SheetLayout = {
    headerAt: 2,
    ref: 0,
    category: 1,
    name: 2,
    status: 3,
    existing: 4,
    missing: 5,
    drafts: 6,
}
const SHORT_LAYOUT: SheetLayout = {
    headerAt: 0,
    ref: 0,
    category: 1,
    name: 2,
    status: 3,
    existing: -1,
    missing: -1,
    drafts: -1,
}

describe("layoutOf", () => {
    it("finds the header row under a title and names the columns by their titles", async () => {
        const subject = await buildSubject()

        expect(subject.layoutOf(SHEET)).toEqual(FULL_LAYOUT)
    })

    it("accepts a header without the optional columns and answers -1 for them", async () => {
        const subject = await buildSubject()

        expect(subject.layoutOf([[columns.ref, columns.category, columns.name, columns.status]])).toEqual(SHORT_LAYOUT)
    })

    it("answers null when no row names the four required columns", async () => {
        const subject = await buildSubject()

        expect(subject.layoutOf([[columns.ref, columns.name], ["x"]])).toBeNull()
        expect(subject.layoutOf([])).toBeNull()
    })
})

describe("statusOf", () => {
    it.each(Object.entries(statuses))("reads the words of %s as that status", async (status, words) => {
        const subject = await buildSubject()

        expect(subject.statusOf(`  ${words.toUpperCase()}  `)).toBe(status)
    })

    it("lets a template cell add words after its own", async () => {
        const subject = await buildSubject()

        expect(subject.statusOf(`${statuses.template} (used when needed)`)).toBe("template")
    })

    it("answers null for words that are none of the five", async () => {
        const subject = await buildSubject()

        expect(subject.statusOf("Under review")).toBeNull()
        expect(subject.statusOf("")).toBeNull()
    })
})

describe("dossiersOf", () => {
    it("keeps the numbered dossiers of a known category and status and counts every other filled row as skipped", async () => {
        const subject = await buildSubject()

        expect(subject.dossiersOf(SHEET, FULL_LAYOUT)).toEqual({
            dossiers: [
                {
                    ref: "1",
                    category: "LEGAL FILES",
                    categoryOrder: 1,
                    position: 1,
                    name: "Registration certificate",
                    status: "present",
                    existing: "Certificate",
                    missing: "Fill the log",
                    drafts: "01. Log.xlsx",
                },
                {
                    ref: "2",
                    category: "LEGAL FILES",
                    categoryOrder: 1,
                    position: 2,
                    name: "Charter",
                    status: "partial",
                    existing: null,
                    missing: null,
                    drafts: null,
                },
                {
                    ref: "4",
                    category: "FORMS",
                    categoryOrder: 12,
                    position: 3,
                    name: "Resolution template",
                    status: "template",
                    existing: null,
                    missing: null,
                    drafts: null,
                },
            ],
            skipped: 7,
        })
    })

    it("leaves the optional columns empty when the header does not have them", async () => {
        const subject = await buildSubject()
        const rows = [
            [columns.ref, columns.category, columns.name, columns.status],
            ["7", "03. COUNCIL", "Resolution", statuses.missing],
        ]

        expect(subject.dossiersOf(rows, SHORT_LAYOUT).dossiers).toEqual([
            expect.objectContaining({ ref: "7", existing: null, missing: null, drafts: null }),
        ])
    })
})
