import { fileUploadBlock } from "./file-upload.block"

const WORD = { key: "word" }
const UPLOAD = { label: WORD, type: "blocks-core.video.render", field: "voice" }
const accepts = (props: unknown): boolean => fileUploadBlock.props.safeParse(props).success

describe("fileUploadBlock", () => {
    it("is the core.file-upload block over one required record and the action that writes it, with no children and no params", () => {
        expect(fileUploadBlock.id).toBe("core.file-upload")
        expect(fileUploadBlock.children).toBe(false)
        expect(fileUploadBlock.slots).toEqual({
            record: { kind: "read", shape: "record", required: true },
            write: { kind: "action", required: true },
        })
        expect(fileUploadBlock.reaches).toBe("type")
        expect(Object.keys(fileUploadBlock.propsJson).length).toBeGreaterThan(0)
    })

    it("takes a label and a declared file field of a record type", () => {
        expect(accepts(UPLOAD)).toBe(true)
    })

    it("takes an id path, the words for an unsaved record and a surface", () => {
        expect(accepts({ ...UPLOAD, idPath: "uuid", idle: WORD, surface: "section" })).toBe(true)
        expect(accepts({ ...UPLOAD, surface: "floating" })).toBe(false)
        expect(accepts({ ...UPLOAD, idPath: "p".repeat(201) })).toBe(false)
    })

    it("refuses a field the declaration does not hold as a file field: another kind, an unknown field, an unknown type", () => {
        expect(accepts({ ...UPLOAD, field: "shopName" })).toBe(false)
        expect(accepts({ ...UPLOAD, field: "nope" })).toBe(false)
        expect(accepts({ ...UPLOAD, type: "video.nope" })).toBe(false)
    })

    it("refuses a missing label, type or field and a field name that is no name", () => {
        expect(accepts({ type: UPLOAD.type, field: UPLOAD.field })).toBe(false)
        expect(accepts({ label: WORD, field: UPLOAD.field })).toBe(false)
        expect(accepts({ label: WORD, type: UPLOAD.type })).toBe(false)
        expect(accepts({ ...UPLOAD, field: "not a name" })).toBe(false)
        expect(accepts({ ...UPLOAD, type: "" })).toBe(false)
    })
})
