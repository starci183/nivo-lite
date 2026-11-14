import { Test } from "@nestjs/testing"
import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import { RecordFilesErrorCode } from "./errors/record-files.error"
import { factsRefusalOf, fileFieldOf, fileNameOf, isRecordId } from "./record-files.policy"

const SUBJECT = Symbol("record-files.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { factsRefusalOf, fileFieldOf, fileNameOf, isRecordId } }],
    }).compile()
    return moduleRef.get<typeof import("./record-files.policy")>(SUBJECT)
}

const PROJECT = defineEntity({
    name: "fixture.project",
    dataKind: "fixture-project",
    fields: { title: field.text({ maxLength: 40 }), cover: field.file({ accept: ["image/*"], maxBytes: 10 }) },
})

describe("record files policy", () => {
    it("finds a declared file field only", async () => {
        const subject = await build()
        expect(subject.fileFieldOf(PROJECT, "cover").kind).toBe("file")
        expect(() => subject.fileFieldOf(PROJECT, "title")).toThrow(RecordFilesErrorCode.FieldNotFile)
        expect(() => subject.fileFieldOf(PROJECT, "constructor")).toThrow(RecordFilesErrorCode.FieldNotFile)
        expect(() => subject.fileFieldOf(undefined, "cover")).toThrow(RecordFilesErrorCode.TypeUnknown)
    })

    it("judges a file by the field's accepted types and size limit", async () => {
        const subject = await build()
        const cover = PROJECT.fields.cover
        expect(subject.factsRefusalOf(cover, "Image/PNG; charset=binary", 10)).toBeNull()
        expect(subject.factsRefusalOf(cover, "video/mp4", 1)).toBe(RecordFilesErrorCode.MimeNotAccepted)
        expect(subject.factsRefusalOf(cover, "image/png", 11)).toBe(RecordFilesErrorCode.SizeInvalid)
        expect(subject.factsRefusalOf(cover, "image/png", 0)).toBe(RecordFilesErrorCode.SizeInvalid)
        expect(subject.factsRefusalOf(cover, "image/png", 1.5)).toBe(RecordFilesErrorCode.SizeInvalid)
    })

    it("keeps a printable, bounded name with no path", async () => {
        const subject = await build()
        expect(subject.fileNameOf("  \u1ea3nh b\u00eca.png ")).toBe("\u1ea3nh b\u00eca.png")
        expect(subject.fileNameOf("../../etc/passwd")).toBe(".. .. etc passwd")
        expect(subject.fileNameOf("\u0000\u0007")).toBe("file")
        expect(subject.fileNameOf("x".repeat(400))).toHaveLength(255)
    })

    it("knows a record id", async () => {
        const subject = await build()
        expect(subject.isRecordId("0b9f1c2e-6d1a-4f0e-9a37-000000000001")).toBe(true)
        expect(subject.isRecordId("1")).toBe(false)
    })
})
