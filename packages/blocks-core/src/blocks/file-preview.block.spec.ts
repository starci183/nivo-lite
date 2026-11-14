import { filePreviewBlock } from "./file-preview.block"

const WORD = { key: "word" }
const PREVIEW = { label: WORD, type: "blocks-core.video.render", field: "clips" }
const accepts = (props: unknown): boolean => filePreviewBlock.props.safeParse(props).success

describe("filePreviewBlock", () => {
    it("is the core.file-preview block over one required record, with no children and no params", () => {
        expect(filePreviewBlock.id).toBe("core.file-preview")
        expect(filePreviewBlock.children).toBe(false)
        expect(filePreviewBlock.slots).toEqual({ record: { kind: "read", shape: "record", required: true } })
        expect(filePreviewBlock.reaches).toBe("type")
        expect(Object.keys(filePreviewBlock.propsJson).length).toBeGreaterThan(0)
    })

    it("takes a label and a declared file field of a record type", () => {
        expect(accepts(PREVIEW)).toBe(true)
    })

    it("takes a poster field that is a declared file field too, an id path, the empty words and a surface", () => {
        expect(accepts({ ...PREVIEW, posterField: "voice", idPath: "uuid", empty: WORD, surface: "plain" })).toBe(true)
        expect(accepts({ ...PREVIEW, posterField: "state" })).toBe(false)
        expect(accepts({ ...PREVIEW, posterField: "nope" })).toBe(false)
        expect(accepts({ ...PREVIEW, surface: "floating" })).toBe(false)
    })

    it("refuses a field the declaration does not hold as a file field", () => {
        expect(accepts({ ...PREVIEW, field: "state" })).toBe(false)
        expect(accepts({ ...PREVIEW, field: "nope" })).toBe(false)
        expect(accepts({ ...PREVIEW, type: "video.nope" })).toBe(false)
    })

    it("refuses a missing label, type or field", () => {
        expect(accepts({ type: PREVIEW.type, field: PREVIEW.field })).toBe(false)
        expect(accepts({ label: WORD, field: PREVIEW.field })).toBe(false)
        expect(accepts({ label: WORD, type: PREVIEW.type })).toBe(false)
    })
})
