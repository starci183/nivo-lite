import { z } from "zod"
import { defineAction, defineRead } from "../block/block"
import type { ActionDefinition, ReadDefinition } from "../block/block.types"
import { BLOCKS, OPEN, ORDERS, docOf } from "../spec/spec.fixture"
import type { ModuleDeclarationConfig } from "./declaration.types"
import { defineModule, seedSpecProblems } from "./declaration"
import { listRead } from "./declaration-list"
import { LEADS, LEADS_PORT, LEAD_COUNTS } from "./declaration.fixture"

const MOVE: ActionDefinition = defineAction({
    id: "sales.move-stage",
    permission: "sales.manage",
    label: { key: "move" },
    input: z.object({ id: z.string().max(40), stage: z.string().max(20) }),
    ports: {},
    run: () => Promise.resolve({ ok: true }),
    refreshes: ["sales.leads", "sales.lead-counts"],
})
const OTHER_READ: ReadDefinition = defineRead({
    id: "crm.people",
    dataKind: "person",
    shape: "list",
    fields: ["id"],
    paths: {},
    variables: z.object({}),
    operation: "people",
    permission: "sales.view",
})

const BARE = listRead({
    id: "sales.bare",
    dataKind: "lead",
    permission: "sales.view",
    fields: ["id"],
    list: { sort: { recent: [["a", "asc"]] }, page: { size: 5 }, row: { id: "id", title: "t" } },
    source: LEADS_PORT,
})
const SOUND = docOf({ id: "ok", block: "test.free", bind: { any: { read: "sales.lead-counts" } } })

const CONFIG: ModuleDeclarationConfig = {
    key: "sales",
    namespace: "sales",
    permissions: ["sales.view", "sales.manage", "sales.read", "sales.write"],
    reads: [LEADS, LEAD_COUNTS, ORDERS],
    actions: [MOVE, OPEN],
    tools: ["nivo.chat.send"],
    specs: [],
}

/** The error a call throws. */
function captured(call: () => unknown): unknown {
    try {
        call()
    } catch (error) {
        return error
    }
    return undefined
}

describe("defineModule", () => {
    it("keeps the declaration and marks the entry", () => {
        expect(defineModule(CONFIG)).toEqual({ ...CONFIG, entry: "module" })
    })

    it("accepts a module with no reads or actions", () => {
        expect(defineModule({ ...CONFIG, reads: [], actions: [] }).entry).toBe("module")
    })

    it("refuses a read or an action whose id is not the module's", () => {
        expect(captured(() => defineModule({ ...CONFIG, reads: [OTHER_READ] }))).toMatchObject({
            code: "MODULE_ID_OUTSIDE",
            at: "crm.people",
        })
        const foreign = defineAction({ id: "crm.open", operation: "o", permission: "sales.write", label: { key: "o" } })
        expect(captured(() => defineModule({ ...CONFIG, actions: [foreign] }))).toMatchObject({
            code: "MODULE_ID_OUTSIDE",
            at: "crm.open",
        })
    })

    it("refuses a key that only shares a prefix with the id", () => {
        expect(captured(() => defineModule({ ...CONFIG, key: "sale" }))).toMatchObject({ code: "MODULE_ID_OUTSIDE" })
    })

    it("refuses a permission the module does not declare, on a read or an action", () => {
        expect(captured(() => defineModule({ ...CONFIG, permissions: ["sales.manage"] }))).toMatchObject({
            code: "MODULE_PERMISSION_UNDECLARED",
            at: "sales.leads",
        })
        expect(
            captured(() => defineModule({ ...CONFIG, reads: [], permissions: ["sales.view", "sales.write"] })),
        ).toMatchObject({ code: "MODULE_PERMISSION_UNDECLARED", at: "sales.move-stage" })
    })

    it("refuses a refreshed read the module does not have", () => {
        expect(captured(() => defineModule({ ...CONFIG, reads: [LEADS, ORDERS] }))).toMatchObject({
            code: "MODULE_REFRESH_UNKNOWN",
            at: "sales.move-stage",
        })
    })

    it("refuses a counts read of a list the module does not have, of a read that is no list, or of a filter the list lacks", () => {
        expect(captured(() => defineModule({ ...CONFIG, reads: [LEAD_COUNTS], actions: [] }))).toMatchObject({
            code: "MODULE_COUNTS_UNKNOWN",
            at: "sales.lead-counts",
        })
        const ofRead = { ...LEAD_COUNTS, listing: { kind: "counts", of: "sales.orders", by: "stage" } } as const
        expect(captured(() => defineModule({ ...CONFIG, reads: [ORDERS, ofRead], actions: [] }))).toMatchObject({
            code: "MODULE_COUNTS_UNKNOWN",
        })
        const bareFilter = { ...LEAD_COUNTS, listing: { kind: "counts", of: "sales.bare", by: "stage" } } as const
        expect(captured(() => defineModule({ ...CONFIG, reads: [BARE, bareFilter], actions: [] }))).toMatchObject({
            code: "MODULE_COUNTS_UNKNOWN",
        })
        const byFilter = { ...LEAD_COUNTS, listing: { kind: "counts", of: "sales.leads", by: "owner" } } as const
        expect(captured(() => defineModule({ ...CONFIG, reads: [LEADS, byFilter], actions: [] }))).toMatchObject({
            code: "MODULE_COUNTS_UNKNOWN",
        })
    })
})

describe("seedSpecProblems", () => {
    const declaration = defineModule({
        ...CONFIG,
        specs: [
            SOUND,
            docOf({ id: "gone", block: "test.nope" }),
            docOf({ id: "guard", block: "test.free", when: { permission: "sales.secret" } }),
        ],
    })

    it("names the index of each seed spec that breaks a rule, against the module's reads, actions and permissions", () => {
        expect(seedSpecProblems(declaration, BLOCKS)).toEqual([
            { spec: 1, problem: { code: "SPEC_BLOCK_UNKNOWN", at: "main/gone" } },
            { spec: 2, problem: { code: "SPEC_WHEN_UNKNOWN", at: "main/guard" } },
        ])
    })

    it("is empty when every seed spec is sound", () => {
        expect(seedSpecProblems(defineModule({ ...CONFIG, specs: [SOUND] }), BLOCKS)).toEqual([])
    })

    it("lets a spec bind the reads of the shared modules, and refuses them when no module is shared", () => {
        const other = defineModule({
            key: "crm",
            namespace: "crm",
            permissions: ["crm.view"],
            reads: [],
            actions: [],
            tools: [],
            specs: [SOUND],
        })
        expect(seedSpecProblems(other, BLOCKS)).toEqual([
            { spec: 0, problem: { code: "SPEC_BINDING_UNKNOWN", at: "main/ok.any" } },
        ])
        expect(seedSpecProblems(other, BLOCKS, [defineModule(CONFIG)])).toEqual([])
    })

    it("is empty for a module with no seed specs", () => {
        expect(seedSpecProblems(defineModule(CONFIG), BLOCKS)).toEqual([])
    })
})
