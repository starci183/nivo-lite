import { z } from "zod"
import type { ActionDefinition, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { recordModulesOf } from "./record-types.policy"

/** A matcher for an object holding at least these members (typed, so it can sit inside an expected value). */
const objectWith = (members: object): unknown => expect.objectContaining(members)

const ORDER: EntityDefinition = {
    entry: "entity",
    name: "blocks-core.sales.order",
    dataKind: "orders",
    fields: {
        code: { kind: "text", nullable: false, maxLength: 20 },
        status: { kind: "enum", nullable: false, of: ["open", "paid"] },
        note: { kind: "text", nullable: true, maxLength: 400 },
    },
}

const OTHER: EntityDefinition = { entry: "entity", name: "blocks-core.video.project", dataKind: "videos", fields: {} }

const LIST: ReadDefinition = {
    entry: "read",
    id: "blocks-core.sales.api.order.list",
    dataKind: "orders",
    shape: "list",
    fields: ["code"],
    paths: {},
    variables: z.object({ q: z.string().max(40).optional() }),
    operation: "",
    permission: "sales.view",
    execute: () => Promise.resolve({ ok: true, data: [] }),
}

const SAVE: ActionDefinition = {
    entry: "action",
    id: "blocks-core.sales.order-save",
    operation: "",
    permission: "sales.edit",
    label: { vi: "L\u01b0u", en: "Save" },
    input: z.object({ code: z.string().max(200) }),
    execute: () => Promise.resolve({ ok: true }),
}

const HOST_ONLY: ActionDefinition = {
    entry: "action",
    id: "blocks-core.sales.order-print",
    operation: "print",
    permission: "sales.view",
    label: { vi: "In", en: "Print" },
}

const SALES: Pick<ModuleDeclaration, "reads" | "actions"> = { reads: [LIST], actions: [SAVE, HOST_ONLY] }

describe("recordModulesOf: the record types of the workspace's installed agents, with the door's reads and actions that reach them", () => {
    it("lists each installed module's own record types with a field summary, and the reads and actions the workbench door serves", () => {
        const modules = recordModulesOf(["sales"], (key) => (key === "sales" ? SALES : null), [ORDER, OTHER])

        expect(modules).toEqual([
            {
                module: "sales",
                types: [
                    {
                        name: "blocks-core.sales.order",
                        fields: [
                            { name: "code", kind: "text", nullable: false, values: null },
                            { name: "status", kind: "enum", nullable: false, values: ["open", "paid"] },
                            { name: "note", kind: "text", nullable: true, values: null },
                        ],
                    },
                ],
                reads: [
                    {
                        id: "blocks-core.sales.api.order.list",
                        dataKind: "orders",
                        shape: "list",
                        permission: "sales.view",
                        variables: objectWith({ type: "object", properties: { q: objectWith({ type: "string" }) } }),
                    },
                ],
                actions: [
                    {
                        id: "blocks-core.sales.order-save",
                        permission: "sales.edit",
                        input: objectWith({ type: "object", required: ["code"] }),
                    },
                ],
            },
        ])
    })

    it("leaves out a module no plugin declares", () => {
        expect(recordModulesOf(["gone"], () => null, [ORDER])).toEqual([])
    })
})
