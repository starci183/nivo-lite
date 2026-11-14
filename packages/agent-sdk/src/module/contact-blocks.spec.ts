import { z } from "zod"
import { defineRecordQuery } from "../block/record-query"
import type { ReadDefinition } from "../block/block.types"
import { defineEntity, field } from "../entity/entity"
import type { AnyEntityDefinition } from "../entity/entity-any.types"
import { BLOCKS, FREE, LIST } from "../spec/spec.fixture"
import type { ModuleDeclarationConfig, ModuleContactBlock } from "./declaration.types"
import { defineModule } from "./declaration"
import { contactBlockNodeOf, contactBlockProblems } from "./contact-blocks"

const ORDER = defineEntity({
    name: "blocks-core.sales.order",
    dataKind: "order",
    fields: { code: field.text({ maxLength: 20 }), contactId: field.contact({ nullable: true }) },
})
const NOTE = defineEntity({
    name: "blocks-core.sales.note",
    dataKind: "order",
    fields: { title: field.text({ maxLength: 20 }) },
})

const queryOf = (id: `${string}.${string}`, type: AnyEntityDefinition, variables: z.ZodObject): ReadDefinition =>
    defineRecordQuery({
        id,
        dataKind: "order",
        shape: "list",
        fields: ["rows"],
        paths: { rows: "list" },
        permission: "sales.view",
        variables,
        type,
        list: () => ({ select: ["code"], order: [["id", "desc"]], page: { size: 5 } }),
    })

const OF_CONTACT = queryOf("blocks-core.sales.api.order.of-contact", ORDER, z.object({ contactId: z.string().max(40) }))
const NO_VARIABLE = queryOf("blocks-core.sales.api.order.recent", ORDER, z.object({ q: z.string().max(40).optional() }))
const NOTES = queryOf("blocks-core.sales.api.note.of-contact", NOTE, z.object({ contactId: z.string().max(40) }))

const BLOCK: ModuleContactBlock = {
    id: "orders",
    title: { vi: "\u0110\u01a1n h\u00e0ng", en: "Orders" },
    read: "blocks-core.sales.api.order.of-contact",
    block: { id: "test.list", slot: "rows", props: { label: "x" } },
}

const configOf = (contactBlocks: ReadonlyArray<ModuleContactBlock>): ModuleDeclarationConfig => ({
    key: "sales",
    namespace: "sales",
    permissions: ["sales.view"],
    reads: [OF_CONTACT, NO_VARIABLE, NOTES],
    actions: [],
    specs: [],
    contactBlocks,
})

const thrown = (make: () => unknown): unknown => {
    try {
        make()
    } catch (error) {
        return error
    }
    return null
}

describe("contactBlocks of a module declaration", () => {
    it("accepts a block over a read of the module that takes a contactId", () => {
        expect(defineModule(configOf([BLOCK])).contactBlocks).toEqual([BLOCK])
    })

    it("refuses a block over a read the module does not declare", () => {
        const error = thrown(() => defineModule(configOf([{ ...BLOCK, read: "blocks-core.sales.api.order.gone" }])))
        expect(error).toMatchObject({ code: "MODULE_CONTACT_BLOCK_READ_UNKNOWN" })
    })

    it("refuses a block over a read with no contactId variable", () => {
        const error = thrown(() => defineModule(configOf([{ ...BLOCK, read: "blocks-core.sales.api.order.recent" }])))
        expect(error).toMatchObject({ code: "MODULE_CONTACT_BLOCK_NO_CONTACT_VARIABLE" })
    })

    it("refuses two blocks with one id", () => {
        const error = thrown(() => defineModule(configOf([BLOCK, BLOCK])))
        expect(error).toMatchObject({ code: "MODULE_CONTACT_BLOCK_DUPLICATE" })
    })
})

describe("contactBlockProblems", () => {
    const problems = (blocks: ReadonlyArray<ModuleContactBlock>) =>
        contactBlockProblems(defineModule(configOf(blocks)), BLOCKS, [ORDER, NOTE])

    it("is empty for a block whose read reaches a type with a contact field and a block the slot fits", () => {
        expect(problems([BLOCK])).toEqual([])
    })

    it("refuses a read over a type with no contact field", () => {
        expect(problems([{ ...BLOCK, read: "blocks-core.sales.api.note.of-contact" }])).toEqual([
            { block: "orders", code: "CONTACT_BLOCK_TYPE_WITHOUT_CONTACT", at: "blocks-core.sales.note" },
        ])
    })

    it("refuses a block the registry does not hold and a slot the block lacks", () => {
        expect(problems([{ ...BLOCK, block: { id: "test.nothing", slot: "rows" } }])).toEqual([
            { block: "orders", code: "CONTACT_BLOCK_SPEC", at: "contact-block/orders", detail: "SPEC_BLOCK_UNKNOWN" },
        ])
        expect(problems([{ ...BLOCK, block: { id: "test.list", slot: "nowhere", props: { label: "x" } } }])).toContainEqual({
            block: "orders",
            code: "CONTACT_BLOCK_SPEC",
            at: "contact-block/orders.nowhere",
            detail: "SPEC_SLOT_UNKNOWN",
        })
    })

    it("refuses a block that names a record slot the read cannot fill", () => {
        const free = { ...BLOCK, block: { id: FREE.id, slot: "any" } }
        expect(problems([free]).map((problem) => problem.detail)).toEqual(["SPEC_BINDING_SHAPE"])
        expect(LIST.slots["rows"]).toBeDefined()
    })
})

describe("contactBlockNodeOf", () => {
    it("binds the block's slot to the read with the contact id as its one variable", () => {
        expect(contactBlockNodeOf(BLOCK, "c-1")).toEqual({
            id: "orders",
            block: "test.list",
            props: { label: "x" },
            bind: { rows: { read: "blocks-core.sales.api.order.of-contact", variables: { contactId: "c-1" } } },
        })
    })
})
