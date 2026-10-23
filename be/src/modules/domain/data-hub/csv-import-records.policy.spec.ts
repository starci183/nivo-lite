import type * as SubjectModule from "./csv-import-records.policy"
import { Test } from "@nestjs/testing"
import { DOCUMENT_MAX_TEXT } from "@modules/integrations/data-sources"
import { buildRecords, recordFromDocument, recordFromGoogleDoc } from "./csv-import-records.policy"
import type { CsvMapping } from "./csv-import.contracts"
import { DataHubErrorCode } from "./errors/data-hub.error"
import { CSV_COPY } from "./messages/csv-import.messages"

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const SUBJECT = Symbol("csv-import-records.policy")
type Subject = Pick<typeof SubjectModule, "buildRecords" | "recordFromDocument" | "recordFromGoogleDoc">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { buildRecords, recordFromDocument, recordFromGoogleDoc } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const mapping: CsvMapping = {
    idColumn: "id",
    titleColumn: "name",
    dateColumn: "when",
    kinds: { id: "text", phone: "phone", mail: "email", amount: "number", when: "date", note: "text" },
    columns: ["id", "name", "phone", "mail", "amount", "when", "note"],
}

describe("buildRecords", () => {
    it("normalises phones, emails, numbers and dates and keeps the original text", async () => {
        const subject = await buildSubject()

        const built = subject.buildRecords(
            {
                headers: mapping.columns,
                rows: [["KH1", "Lan", "+84 912 345 678", "Lan@Example.com", "1.200", "14/10/2026", "hi"]],
            },
            mapping,
        )
        expect(built).toEqual({
            skipped: 0,
            duplicates: 0,
            records: [
                {
                    externalId: "KH1",
                    title: "Lan",
                    occurredAt: "2026-10-13T17:00:00.000Z",
                    data: {
                        id: "KH1",
                        name: "Lan",
                        phone: "0912345678",
                        phone__raw: "+84 912 345 678",
                        mail: "lan@example.com",
                        amount: "1.200",
                        amount__number: 1200,
                        when: "14/10/2026",
                        when__date: "2026-10-13T17:00:00.000Z",
                        note: "hi",
                    },
                },
            ],
        })
    })

    it("keeps a phone that is already digits and skips a value that is not a number or a date", async () => {
        const subject = await buildSubject()

        const built = subject.buildRecords(
            {
                headers: ["phone", "amount", "when"],
                rows: [["0912", "abc", "later"]],
            },
            { ...mapping, idColumn: null, titleColumn: null, dateColumn: null },
        )
        expect(built.records[0]).toMatchObject({
            externalId: "row-1",
            title: CSV_COPY.rowTitle(1),
            occurredAt: null,
            data: { phone: "0912", amount: "abc", when: "later" },
        })
        expect(built.records[0]?.data).not.toHaveProperty("phone__raw")
        expect(built.records[0]?.data).not.toHaveProperty("amount__number")
        expect(built.records[0]?.data).not.toHaveProperty("when__date")
    })

    it("uses the raw phone text when it has no digits, and a phone id when the id column is a phone", async () => {
        const subject = await buildSubject()

        const built = subject.buildRecords(
            { headers: ["id", "name"], rows: [["+84 912 345 678", ""]] },
            { ...mapping, idColumn: "id", titleColumn: "name", kinds: { id: "phone", name: "text" } },
        )
        expect(built.records[0]).toMatchObject({ externalId: "0912345678", title: "0912345678" })
        const words = subject.buildRecords(
            { headers: ["phone"], rows: [["abc"]] },
            { ...mapping, idColumn: null, titleColumn: null, dateColumn: null, kinds: { phone: "phone" } },
        )
        expect(words.records[0]?.data).toEqual({ phone: "abc" })
    })
})

describe("buildRecords", () => {
    it("skips a blank id or an id over 300 characters and counts a repeated id once", async () => {
        const subject = await buildSubject()

        const built = subject.buildRecords(
            {
                headers: ["id", "name"],
                rows: [
                    ["", ""],
                    ["", "Lan"],
                    ["a".repeat(301), "Long"],
                    ["KH1", "First"],
                    ["KH1", "Second"],
                ],
            },
            { ...mapping, dateColumn: null, kinds: { id: "text", name: "text" } },
        )
        expect(built.skipped).toBe(2)
        expect(built.duplicates).toBe(1)
        expect(built.records).toEqual([
            { externalId: "KH1", title: "Second", occurredAt: null, data: { id: "KH1", name: "Second" } },
        ])
    })

    it("cuts a title at 300 characters and ignores an unknown kind as text", async () => {
        const subject = await buildSubject()

        const kinds: CsvMapping["kinds"] = { id: "text", name: "text" }
        Reflect.set(kinds, "name", "nope")
        const built = subject.buildRecords(
            { headers: ["id", "name"], rows: [["KH1", "n".repeat(400)]] },
            {
                ...mapping,
                dateColumn: null,
                kinds,
            },
        )
        expect(built.records[0]?.title).toHaveLength(300)
        expect(built.records[0]?.data.name).toBe("n".repeat(400))
    })

    it("reads a missing cell as empty and skips a row with nothing in it", async () => {
        const subject = await buildSubject()

        const built = subject.buildRecords(
            { headers: ["id", "name"], rows: [[]] },
            { ...mapping, idColumn: null, titleColumn: "name", dateColumn: null },
        )
        expect(built).toEqual({ records: [], skipped: 0, duplicates: 0 })
    })

    it("skips a missing id and uses a numbered title when mapped title and date cells are absent", async () => {
        const subject = await buildSubject()

        expect(
            subject.buildRecords(
                { headers: ["note", "id"], rows: [["Present"]] },
                { ...mapping, idColumn: "id", titleColumn: null, dateColumn: null, kinds: {} },
            ),
        ).toEqual({ records: [], skipped: 1, duplicates: 0 })
        expect(
            subject.buildRecords(
                { headers: ["note", "name", "when"], rows: [["Present"]] },
                { ...mapping, idColumn: null, titleColumn: "name", dateColumn: "when", kinds: {} },
            ),
        ).toEqual({
            records: [
                { externalId: "row-1", title: CSV_COPY.rowTitle(1), occurredAt: null, data: { note: "Present" } },
            ],
            skipped: 0,
            duplicates: 0,
        })
    })
})

describe("buildRecords", () => {
    it("uses the original text for a phone id containing no digits", async () => {
        const subject = await buildSubject()

        expect(
            subject.buildRecords(
                { headers: ["id"], rows: [["words"]] },
                { ...mapping, idColumn: "id", titleColumn: null, dateColumn: null, kinds: { id: "phone" } },
            ),
        ).toEqual({
            records: [{ externalId: "words", title: "words", occurredAt: null, data: { id: "words" } }],
            skipped: 0,
            duplicates: 0,
        })
    })
})

describe("recordFromDocument", () => {
    it("uses the heading and keeps the page count", async () => {
        const subject = await buildSubject()

        expect(
            subject.recordFromDocument("C:\\docs\\guide.pdf", { text: "# Uploaded\r\nBody\u0000", pages: 2 }),
        ).toEqual({
            externalId: "guide.pdf",
            title: "Uploaded",
            data: { text: "# Uploaded\nBody", source: "upload", fileName: "guide.pdf", pages: 2 },
        })
    })

    it("uses the first line when there is no heading, and omits pages", async () => {
        const subject = await buildSubject()

        expect(subject.recordFromDocument("notes/plain.txt", { text: "  First line\nsecond" })).toEqual({
            externalId: "plain.txt",
            title: "First line",
            data: { text: "First line\nsecond", source: "upload", fileName: "plain.txt" },
        })
    })

    it.each([
        ["\n \n  First non-empty line\nSecond line", "First non-empty line"],
        ["Intro\n\n## Later heading\nBody", "Later heading"],
        ["Intro\n##   \n", "Intro"],
        [`# ${" ".repeat(20000)}Heading`, "Heading"],
        ["###\nBody", "Body"],
        ["x".repeat(121), "x".repeat(120)],
    ])("chooses the title from uploaded text %p", async (text, title) => {
        const subject = await buildSubject()

        expect(subject.recordFromDocument("plain.txt", { text }).title).toBe(title)
    })

    it("falls back to the file name when the heading is only marks", async () => {
        const subject = await buildSubject()

        expect(subject.recordFromDocument("marks.md", { text: "###" }).title).toBe("marks.md")
    })

    it("structurally preserves the file name for a synthetic missing title line", async () => {
        const subject = await buildSubject()

        const split = jest.spyOn(String.prototype, "split").mockReturnValueOnce([])
        try {
            expect(subject.recordFromDocument("notes/plain.txt", { text: "Body" })).toEqual({
                externalId: "plain.txt",
                title: "plain.txt",
                data: { text: "Body", source: "upload", fileName: "plain.txt" },
            })
        } finally {
            split.mockRestore()
        }
    })

    it("marks a document that was cut and refuses one with no text", async () => {
        const subject = await buildSubject()

        const text = `${"a".repeat(DOCUMENT_MAX_TEXT)}\nmore`
        expect(subject.recordFromDocument("long.txt", { text }).data).toMatchObject({ truncated: true })
        const actualText = subject.recordFromDocument("long.txt", { text }).data.text
        expect(typeof actualText).toBe("string")
        if (typeof actualText === "string") expect(actualText).toHaveLength(DOCUMENT_MAX_TEXT)
        expect(thrownBy(() => subject.recordFromDocument("empty.txt", { text: " \n " }))).toEqual(
            objectLike({
                code: DataHubErrorCode.Invalid,
                params: { detail: CSV_COPY.documentNoText("empty.txt") },
            }),
        )
    })
})

describe("recordFromGoogleDoc", () => {
    it("strips a byte-order mark and names the document from its heading", async () => {
        const subject = await buildSubject()

        expect(subject.recordFromGoogleDoc("document-1", "\uFEFF# Linked\nBody")).toEqual({
            externalId: "document-1",
            title: "Linked",
            data: { text: "# Linked\nBody", source: "google_docs", docId: "document-1" },
        })
    })

    it("uses a short id when the document has no title line, and refuses an empty export", async () => {
        const subject = await buildSubject()

        expect(subject.recordFromGoogleDoc("document-1234", "###").title).toBe(CSV_COPY.googleDocTitle("document"))
        expect(thrownBy(() => subject.recordFromGoogleDoc("document-1", " "))).toEqual(
            objectLike({
                code: DataHubErrorCode.Invalid,
                params: { detail: CSV_COPY.googleDocEmpty },
            }),
        )
    })

    it.each([
        ["\uFEFF\n \n  First non-empty line\nSecond line", "First non-empty line"],
        ["Intro\n\n## Later heading\nBody", "Later heading"],
        ["###\nBody", "Body"],
    ])("chooses the title from a Google export %p", async (text, title) => {
        const subject = await buildSubject()

        expect(subject.recordFromGoogleDoc("document-1234", text).title).toBe(title)
    })

    it("structurally preserves the Google default for a synthetic missing title line", async () => {
        const subject = await buildSubject()

        const split = jest.spyOn(String.prototype, "split").mockReturnValueOnce([])
        try {
            expect(subject.recordFromGoogleDoc("document-1234", "Body")).toEqual({
                externalId: "document-1234",
                title: "Google Docs document",
                data: { text: "Body", source: "google_docs", docId: "document-1234" },
            })
        } finally {
            split.mockRestore()
        }
    })

    it("marks a Google Doc that was cut", async () => {
        const subject = await buildSubject()

        const raw = "a".repeat(DOCUMENT_MAX_TEXT + 1)
        expect(subject.recordFromGoogleDoc("document-1", raw).data).toMatchObject({ truncated: true })
    })
})
