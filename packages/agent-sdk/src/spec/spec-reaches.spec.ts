import { z } from "zod"
import { defineAction, defineBlock, defineRead } from "../block/block"
import type { ActionDefinition, BlockDefinition, ReadDefinition } from "../block/block.types"
import { defineEntity, field } from "../entity/entity"
import { entityPort } from "../entity/port/entity-port"
import { specProblems } from "./spec"
import { docOf } from "./spec.fixture"
import type { SpecNode } from "./spec.types"
import type { Namespaced } from "../schema/schema.types"

const photo = defineEntity({ name: "test.shop.photo", dataKind: "shop-photo", fields: { name: field.text({ maxLength: 20 }) } })
const other = defineEntity({ name: "test.shop.other", dataKind: "shop-other", fields: { name: field.text({ maxLength: 20 }) } })

const FILES: BlockDefinition = defineBlock({
    id: "test.files",
    title: { key: "files" },
    props: z.object({ type: z.string().max(100) }),
    slots: { record: { kind: "read", shape: "record", required: true }, write: { kind: "action", required: false } },
    children: false,
    reaches: "type",
})

const readOf = (id: Namespaced, entity: typeof photo | null): ReadDefinition =>
    defineRead({
        id,
        dataKind: "shop-photo",
        shape: "record",
        fields: ["id"],
        paths: {},
        variables: z.object({}),
        permission: "shop.view",
        ports: entity === null ? {} : { photos: entityPort(entity) },
        run: () => Promise.resolve(null),
    })

const actionOf = (id: Namespaced, entity: typeof photo): ActionDefinition =>
    defineAction({
        id,
        permission: "shop.manage",
        label: { key: "save" },
        input: z.object({}),
        ports: { photos: entityPort(entity) },
        run: () => Promise.resolve({ ok: true }),
        refreshes: [],
    })

const BINDINGS = {
    reads: [readOf("shop.photo", photo), readOf("shop.other", other), readOf("shop.hostop", null)],
    actions: [actionOf("shop.photo-save", photo), actionOf("shop.other-save", other)],
}

const nodeOf = (bind: NonNullable<SpecNode["bind"]>): SpecNode => ({
    id: "f",
    block: "test.files",
    props: { type: "test.shop.photo" },
    bind,
})

describe("specProblems reaches", () => {
    it("accepts a read and an action that declare the record type's entity port", () => {
        const node = nodeOf({ record: { read: "shop.photo" }, write: { action: "shop.photo-save" } })
        expect(specProblems(docOf(node), [FILES], BINDINGS)).toEqual([])
    })

    it("refuses a read or action that reaches another type, or declares no port, naming the slot", () => {
        const node = nodeOf({ record: { read: "shop.other" }, write: { action: "shop.other-save" } })
        expect(specProblems(docOf(node), [FILES], BINDINGS)).toEqual([
            { code: "SPEC_BINDING_ENTITY", at: "main/f.record" },
            { code: "SPEC_BINDING_ENTITY", at: "main/f.write" },
        ])
        const hostOperation = nodeOf({ record: { read: "shop.hostop" } })
        expect(specProblems(docOf(hostOperation), [FILES], BINDINGS)).toEqual([{ code: "SPEC_BINDING_ENTITY", at: "main/f.record" }])
    })

    it("is not judged where the caller does not know the bindings", () => {
        const node = nodeOf({ record: { read: "shop.other" } })
        expect(specProblems(docOf(node), [FILES])).toEqual([])
    })
})
