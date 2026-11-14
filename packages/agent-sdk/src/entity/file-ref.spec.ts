import { mutationProblems } from "../mutation/mutation-problems"
import { kindClassOf } from "../query/field-resolve"
import { defineEntity, field } from "./entity"
import { EntityDefinitionError } from "./entity-error"
import { entityLocalProblems } from "./entity-problems"
import { rowSchemaOf } from "./entity-readers"
import type { EntityProblemCode, FieldDef, RowOf } from "./entity.types"
import {
    FILE_BYTES_CEILING,
    fileListSchemaOf,
    fileMimeOf,
    fileRefSchemaOf,
    fileRefsOf,
    isFileAccept,
    isFileKey,
    isFileList,
    mimeAccepted,
} from "./file-ref"
import type { FileRef } from "./file-ref"
import type { JsonValue } from "../schema"
import { PG_TYPE } from "./plan-names"
import { expectedChecks } from "./plan-expect"
import { fieldCheckSql } from "./render-ddl"
import { exprOf } from "./render-sql"

const MB = 1024 * 1024

const project = defineEntity({
    name: "fixture.project",
    dataKind: "fixture-project",
    fields: {
        title: field.text({ maxLength: 40 }),
        cover: field.file({ accept: ["image/*"], maxBytes: 5 * MB }),
        voice: field.file({ accept: ["audio/mpeg", "audio/wav"], maxBytes: 20 * MB }),
        photos: field.file({ accept: ["image/*"], maxBytes: 5 * MB, many: true, max: 4 }),
    },
})

const ref = (patch: Partial<FileRef> = {}): FileRef => ({
    key: "11111111-1111-4111-8111-111111111111/fixture.project/0b9f1c2e-6d1a-4f0e-9a37-000000000001/cover/a1",
    mime: "image/png",
    size: 1000,
    name: "cover.png",
    ...patch,
})

const codesOf = (name: string, declared: FieldDef): ReadonlyArray<EntityProblemCode> =>
    entityLocalProblems({
        entry: "entity",
        name: "fixture.thing",
        dataKind: "fixture-thing",
        fields: { [name]: declared },
    }).map((problem) => problem.code)

describe("field.file", () => {
    it("builds a nullable reference field with its limits and no default", () => {
        expect(project.fields.cover).toEqual({ kind: "file", nullable: true, accept: ["image/*"], maxBytes: 5 * MB })
        expect(Object.isFrozen(project.fields.cover.accept)).toBe(true)
    })

    it("refuses a declaration with no, empty or malformed accepted types", () => {
        expect(codesOf("f", { kind: "file", nullable: true, maxBytes: 10 })).toEqual(["ENTITY_FILE_ACCEPT_INVALID"])
        expect(codesOf("f", { kind: "file", nullable: true, maxBytes: 10, accept: ["png"] })).toEqual([
            "ENTITY_FILE_ACCEPT_INVALID",
        ])
        expect(codesOf("f", { kind: "file", nullable: true, maxBytes: 10, accept: ["Image/PNG"] })).toEqual([
            "ENTITY_FILE_ACCEPT_INVALID",
        ])
    })

    it("refuses a missing, fractional, zero or too large size limit", () => {
        for (const maxBytes of [undefined, 1.5, 0, FILE_BYTES_CEILING + 1]) {
            const declared: FieldDef = { kind: "file", nullable: true, accept: ["image/*"], ...(maxBytes === undefined ? {} : { maxBytes }) }
            expect(codesOf("f", declared)).toEqual(["ENTITY_FILE_MAX_BYTES_INVALID"])
        }
    })

    it("refuses a file field that is not nullable or has a default", () => {
        expect(codesOf("f", { kind: "file", nullable: false, accept: ["image/*"], maxBytes: 10 })).toEqual([
            "ENTITY_FILE_PRESENCE_INVALID",
        ])
        expect(codesOf("f", { kind: "file", nullable: true, accept: ["image/*"], maxBytes: 10, default: "empty" })).toEqual([
            "ENTITY_FILE_PRESENCE_INVALID",
        ])
    })

    it("refuses file limits on a field of another kind", () => {
        expect(codesOf("f", { kind: "text", nullable: true, maxLength: 5, accept: ["image/*"], maxBytes: 3 })).toEqual([
            "ENTITY_FILE_ACCEPT_INVALID",
            "ENTITY_FILE_MAX_BYTES_INVALID",
        ])
    })

    it("throws at definition for a bad file field", () => {
        expect(() =>
            defineEntity({
                name: "fixture.bad",
                dataKind: "fixture-bad",
                fields: { cover: { kind: "file", nullable: true, accept: ["image/*"], maxBytes: -1 } },
            }),
        ).toThrow(EntityDefinitionError)
    })
})

describe("the file reference values", () => {
    it("admits exact types and families", () => {
        expect(mimeAccepted(["image/*"], "image/webp")).toBe(true)
        expect(mimeAccepted(["audio/mpeg"], "audio/wav")).toBe(false)
        expect(mimeAccepted(["image/*"], "video/mp4")).toBe(false)
        expect(isFileAccept("image/*")).toBe(true)
        expect(isFileAccept("*/*")).toBe(false)
        expect(fileMimeOf(" Image/PNG; q=1")).toBe("image/png")
    })

    it("knows a safe object key", () => {
        expect(isFileKey(ref().key)).toBe(true)
        expect(isFileKey("a/../b")).toBe(false)
        expect(isFileKey("/a")).toBe(false)
        expect(isFileKey("a//b")).toBe(false)
        expect(isFileKey("a/b c")).toBe(false)
    })

    it("parses a write by the field's own limits", () => {
        const schema = fileRefSchemaOf(project.fields.cover)
        expect(schema.safeParse(ref()).success).toBe(true)
        expect(schema.safeParse(ref({ mime: "video/mp4" })).success).toBe(false)
        expect(schema.safeParse(ref({ size: 5 * MB + 1 })).success).toBe(false)
        expect(schema.safeParse({ ...ref(), bytes: "AAAA" }).success).toBe(false)
    })

    it("refuses a write off the field's limits as any value off its kind", () => {
        const write = (values: Record<string, JsonValue>) =>
            mutationProblems(
                { op: "update", entity: project.name, key: "0b9f1c2e-6d1a-4f0e-9a37-000000000001", expected: "1", values },
                [project],
                "action",
            ).map((problem) => problem.code)
        expect(write({ cover: ref() })).toEqual([])
        expect(write({ cover: null })).toEqual([])
        expect(write({ cover: ref({ mime: "audio/mpeg" }) })).toEqual(["MUTATION_VALUE_INVALID"])
        expect(write({ voice: ref({ mime: "audio/mpeg", size: 21 * MB }) })).toEqual(["MUTATION_VALUE_INVALID"])
        expect(write({ cover: "s3://bucket/object" })).toEqual(["MUTATION_VALUE_INVALID"])
    })

    it("reads any bounded reference back, whatever the field accepts now", () => {
        const row = rowSchemaOf(project).safeParse({
            id: "0b9f1c2e-6d1a-4f0e-9a37-000000000001",
            workspaceId: "11111111-1111-4111-8111-111111111111",
            version: "1",
            createdAt: "2026-11-13T00:00:00.000Z",
            updatedAt: "2026-11-13T00:00:00.000Z",
            title: "a",
            cover: ref({ mime: "video/mp4" }),
            voice: null,
            photos: [],
        })
        expect(row.success).toBe(true)
    })
})

describe("the plan of a file field", () => {
    it("is a jsonb object in data with a key and a size, compared as json", () => {
        expect(PG_TYPE.file).toBe("jsonb")
        expect(kindClassOf("file")).toBe("json")
        expect(exprOf(project, "cover")).toBe("(data->'cover')")
        expect(fieldCheckSql("cover", project.fields.cover)).toBe(
            "(data->>'cover') IS NULL OR (jsonb_typeof(data->'cover') = 'object' AND jsonb_typeof(data->'cover'->'key') = 'string' AND jsonb_typeof(data->'cover'->'size') = 'number')",
        )
    })
})

describe("field.file with many: an ordered list of references", () => {
    const photos = project.fields.photos
    const listRef = (n: number, patch: Partial<FileRef> = {}): FileRef => ref({ key: `${ref().key.slice(0, -2)}p${n}`, name: `p${n}.png`, ...patch })

    it("builds a field that is never null and empty by default, typed as a list of references", () => {
        expect(photos).toEqual({
            kind: "file",
            nullable: false,
            accept: ["image/*"],
            maxBytes: 5 * MB,
            many: true,
            max: 4,
            default: "empty",
        })
        const typed: RowOf<typeof project>["photos"] = [ref()]
        expect(typed).toHaveLength(1)
    })

    it("refuses a list without a whole max of 1 to 100, a nullable list, a list with another default, and many or max on a single or other field", () => {
        const base = { kind: "file", nullable: false, accept: ["image/*"], maxBytes: 10, many: true, default: "empty" } as const
        for (const max of [undefined, 0, 1.5, 101]) {
            expect(codesOf("f", { ...base, ...(max === undefined ? {} : { max }) })).toEqual(["ENTITY_FILE_MANY_INVALID"])
        }
        expect(codesOf("f", { ...base, max: 3 })).toEqual([])
        expect(codesOf("f", { ...base, max: 3, nullable: true })).toEqual(["ENTITY_FILE_PRESENCE_INVALID"])
        expect(codesOf("f", { kind: "file", nullable: false, accept: ["image/*"], maxBytes: 10, many: true, max: 3 })).toEqual([
            "ENTITY_FILE_PRESENCE_INVALID",
        ])
        expect(codesOf("f", { kind: "file", nullable: true, accept: ["image/*"], maxBytes: 10, max: 3 })).toEqual([
            "ENTITY_FILE_MANY_INVALID",
        ])
        expect(codesOf("f", { kind: "text", nullable: true, maxLength: 5, many: true, max: 3 })).toEqual(["ENTITY_FILE_MANY_INVALID"])
    })

    it("parses a write by the field's own limits for each reference, the count and the keys", () => {
        const schema = fileListSchemaOf(photos)
        expect(schema.safeParse([]).success).toBe(true)
        expect(schema.safeParse([listRef(1), listRef(2), listRef(3), listRef(4)]).success).toBe(true)
        expect(schema.safeParse([listRef(1), listRef(2), listRef(3), listRef(4), listRef(5)]).success).toBe(false)
        expect(schema.safeParse([listRef(1), listRef(1)]).success).toBe(false)
        expect(schema.safeParse([listRef(1, { mime: "video/mp4" })]).success).toBe(false)
        expect(schema.safeParse([listRef(1, { size: 5 * MB + 1 })]).success).toBe(false)
        expect(schema.safeParse(listRef(1)).success).toBe(false)
        expect(schema.safeParse(null).success).toBe(false)
    })

    it("refuses a write off the field's limits as any value off its kind, and takes the same set in another order", () => {
        const write = (values: Record<string, JsonValue>) =>
            mutationProblems(
                { op: "update", entity: project.name, key: "0b9f1c2e-6d1a-4f0e-9a37-000000000001", expected: "1", values },
                [project],
                "action",
            ).map((problem) => problem.code)
        expect(write({ photos: [listRef(1), listRef(2)] })).toEqual([])
        expect(write({ photos: [listRef(2), listRef(1)] })).toEqual([])
        expect(write({ photos: null })).toEqual(["MUTATION_VALUE_INVALID"])
        expect(write({ photos: listRef(1) })).toEqual(["MUTATION_VALUE_INVALID"])
        expect(write({ photos: [listRef(1), listRef(1)] })).toEqual(["MUTATION_VALUE_INVALID"])
        expect(write({ cover: [ref()] })).toEqual(["MUTATION_VALUE_INVALID"])
    })

    it("reads any bounded stored list back, and names the references of either form in order", () => {
        expect(fileRefsOf(photos, [listRef(2), listRef(1)]).map((item) => item.name)).toEqual(["p2.png", "p1.png"])
        expect(fileRefsOf(project.fields.cover, ref())).toEqual([ref()])
        expect(fileRefsOf(project.fields.cover, null)).toEqual([])
        expect(fileRefsOf(photos, "nonsense")).toEqual([])
        expect(isFileList(photos)).toBe(true)
        expect(isFileList(project.fields.cover)).toBe(false)
    })

    it("is a jsonb array in data bounded by its max, and the plan compares that bound like a text length", () => {
        expect(fieldCheckSql("photos", photos)).toBe(
            "(data->>'photos') IS NOT NULL AND (jsonb_typeof(data->'photos') = 'array' AND jsonb_array_length(data->'photos') <= 4)",
        )
        const checks = expectedChecks(project)
        expect(checks.find((check) => check.key === "photos")?.limit).toBe(4)
        expect(checks.find((check) => check.key === "cover")?.limit).toBeNull()
    })
})
