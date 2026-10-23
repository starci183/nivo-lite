import type * as SubjectModule from "./csv-import-source.policy"
import { Test } from "@nestjs/testing"
import { TABLE_MAX_BYTES, TABLE_MAX_ROWS } from "@modules/integrations/data-sources"
import { DataHubErrorCode } from "./errors/data-hub.error"
import { CSV_COPY } from "./messages/csv-import.messages"
import { decodeUpload, gridOf, pastedText } from "./csv-import-source.policy"

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

const SUBJECT = Symbol("csv-import-source.policy")
type Subject = Pick<typeof SubjectModule, "decodeUpload" | "pastedText" | "gridOf">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { decodeUpload, pastedText, gridOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const refused = (detail: string) => ({ code: DataHubErrorCode.Invalid, params: { detail } })

describe("decodeUpload", () => {
    it("returns null for a missing or empty file", async () => {
        const subject = await buildSubject()

        expect(subject.decodeUpload(null)).toBeNull()
        expect(subject.decodeUpload(undefined)).toBeNull()
        expect(subject.decodeUpload({ name: "empty.csv", contentBase64: "" })).toBeNull()
    })

    it("decodes a small file", async () => {
        const subject = await buildSubject()

        expect(subject.decodeUpload({ name: "customers.csv", contentBase64: "YWJj" })).toEqual({
            name: "customers.csv",
            bytes: Buffer.from("abc"),
        })
    })

    it("refuses a file over ten megabytes", async () => {
        const subject = await buildSubject()

        const contentBase64 = Buffer.alloc(TABLE_MAX_BYTES + 1).toString("base64")
        expect(thrownBy(() => subject.decodeUpload({ name: "huge.csv", contentBase64 }))).toEqual(
            objectLike(refused(CSV_COPY.textTooLarge)),
        )
    })
})

describe("pastedText", () => {
    it("keeps pasted table text", async () => {
        const subject = await buildSubject()

        expect(subject.pastedText("id,name")).toBe("id,name")
    })

    it.each([
        ["null", null],
        ["undefined", undefined],
        ["blank", "  \n"],
    ])("refuses %s", async (_label, raw) => {
        const subject = await buildSubject()

        expect(thrownBy(() => subject.pastedText(raw))).toEqual(objectLike(refused(CSV_COPY.pasteTable)))
    })

    it("refuses text over ten megabytes", async () => {
        const subject = await buildSubject()

        expect(thrownBy(() => subject.pastedText("a".repeat(TABLE_MAX_BYTES + 1)))).toEqual(
            objectLike(refused(CSV_COPY.textTooLarge)),
        )
    })
})

describe("gridOf", () => {
    it("cleans headers and cells and keeps a number or boolean as text", async () => {
        const subject = await buildSubject()

        expect(
            subject.gridOf({ headers: ["Name", 1, true, { bad: true }], rows: [[" Lan ", 2, false, null]] }),
        ).toEqual({
            headers: ["Name", "1", "true", ""],
            rows: [[" Lan ", "2", "false", ""]],
        })
    })

    it("refuses a grid with no named column", async () => {
        const subject = await buildSubject()

        expect(thrownBy(() => subject.gridOf({ headers: ["  ", ""], rows: [] }))).toEqual(
            objectLike(refused(CSV_COPY.nameAColumn)),
        )
        expect(thrownBy(() => subject.gridOf(null))).toEqual(objectLike(refused(CSV_COPY.nameAColumn)))
        expect(thrownBy(() => subject.gridOf({ rows: [["a"]] }))).toEqual(objectLike(refused(CSV_COPY.nameAColumn)))
    })

    it("drops rows past the table limit and ignores a row that is not a list", async () => {
        const subject = await buildSubject()

        const rows: Array<unknown> = Array.from({ length: TABLE_MAX_ROWS + 2 }, (_, index) => [String(index)])
        rows[1] = "not-a-row"
        const grid = subject.gridOf({ headers: ["n"], rows })
        expect(grid.rows).toHaveLength(TABLE_MAX_ROWS + 1)
        expect(grid.rows[0]).toEqual(["0"])
        expect(grid.rows[1]).toEqual([])
        expect(grid.rows.at(-1)).toEqual([String(TABLE_MAX_ROWS)])
    })

    it("cuts a cell at its limit", async () => {
        const subject = await buildSubject()

        expect(subject.gridOf({ headers: ["h"], rows: [["x".repeat(5_001)]] }).rows[0]?.[0]).toHaveLength(5_000)
        expect(subject.gridOf({ headers: ["h".repeat(200)] }).headers[0]).toHaveLength(120)
    })

    it("treats a non-list of rows as none", async () => {
        const subject = await buildSubject()

        expect(subject.gridOf({ headers: ["h"], rows: "nope" })).toEqual({ headers: ["h"], rows: [] })
    })
})
