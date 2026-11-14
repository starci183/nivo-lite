import { FILE_FIELD_MAX, fileField, fileType, isDeclaredFileField } from "./file-field-props"

describe("isDeclaredFileField", () => {
    it("is true only for a field the entity declarations declare as a file field", () => {
        expect(isDeclaredFileField("blocks-core.video.render", "voice")).toBe(true)
        expect(isDeclaredFileField("blocks-core.video.render", "clips")).toBe(true)
        expect(isDeclaredFileField("blocks-core.hiring.candidate", "cv")).toBe(true)
        expect(isDeclaredFileField("blocks-core.video.render", "state")).toBe(false)
        expect(isDeclaredFileField("blocks-core.video.render", "nope")).toBe(false)
        expect(isDeclaredFileField("nope.nope", "voice")).toBe(false)
    })
})

describe("fileType and fileField", () => {
    it("bound the names a block takes", () => {
        expect(fileType.safeParse("blocks-core.video.render").success).toBe(true)
        expect(fileType.safeParse("").success).toBe(false)
        expect(fileField.safeParse("voice").success).toBe(true)
        expect(fileField.safeParse("f".repeat(FILE_FIELD_MAX + 1)).success).toBe(false)
        expect(fileField.safeParse("1music").success).toBe(false)
    })
})
