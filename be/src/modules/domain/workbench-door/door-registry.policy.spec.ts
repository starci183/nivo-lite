import { Test } from "@nestjs/testing"
import type { ActionDefinition, ListShape, ListSource, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { countsRead, listRead } from "@nivo-lite/agent-sdk/module"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { DOOR_PORT_ID } from "@nivo-lite/agent-sdk/mutation"
import { definePort } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { mock } from "@starci/jest-preset"
import { WorkbenchDoorErrorCode } from "./errors/workbench-door.error"
import { registryOf as realRegistryOf } from "./door-registry.policy"

const SUBJECT = Symbol("door-registry.policy")

interface Subject {
    readonly registryOf: typeof realRegistryOf
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { registryOf: realRegistryOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const SHAPE: ListShape = {
    filters: { stage: { field: "stage", op: "eq", of: ["new", "won"] } },
    sort: { recent: [["updatedAt", "desc"]] },
    page: { size: 30 },
    row: { id: "id", title: "name" },
}

const LEADS = listRead({
    id: "sales.leads",
    dataKind: "lead",
    permission: "sales.view",
    fields: ["id", "name"],
    list: SHAPE,
    source: definePort<ListSource<unknown>>("sales.leads-list"),
})

const COUNTS = countsRead({ id: "sales.lead-counts", of: LEADS, by: "stage" })

const actionOf = (id: ActionDefinition["id"], overrides: Partial<ActionDefinition> = {}): ActionDefinition => ({
    entry: "action",
    id,
    operation: id,
    permission: "sales.manage",
    label: { key: "sales.label" },
    execute: () => Promise.resolve({ ok: true }),
    ...overrides,
})

const moduleOf = (
    key: string,
    reads: ReadonlyArray<ReadDefinition>,
    actions: ReadonlyArray<ActionDefinition>,
): ModuleDeclaration => ({
    entry: "module",
    key,
    namespace: key,
    permissions: ["sales.view", "sales.manage"],
    reads,
    actions,
    specs: [],
})

const MALFORMED = "Sales.Move-Stage"
const LEAD = mock<EntityDefinition>({ name: "sales.lead", dataKind: "lead" })
const COUNTED = mock<EntityDefinition>({ name: "sales.counted", dataKind: "counts" })

const doorPort: PortDefinition<unknown> = { entry: "port", id: DOOR_PORT_ID }

/** What the work throws, or undefined when it does not throw. */
const thrown = (work: () => unknown): unknown => {
    try {
        work()
    } catch (cause) {
        return cause
    }
    return undefined
}

describe("registryOf", () => {
    let registryOf: Subject["registryOf"]

    beforeAll(async () => {
        ;({ registryOf } = await build())
    })

    it("serves the reads and actions that run in the package, by id, with the permission each declares", () => {
        const registry = registryOf([moduleOf("sales", [LEADS], [actionOf("sales.move-stage")])], [LEAD])

        expect([...registry.reads.keys()]).toEqual(["sales.leads"])
        expect(registry.reads.get("sales.leads")?.definition.permission).toBe("sales.view")
        expect([...registry.actions.keys()]).toEqual(["sales.move-stage"])
        expect(registry.actions.get("sales.move-stage")?.permission).toBe("sales.manage")
    })

    it("does not serve a read or action that names a host operation", () => {
        const hosted: ReadDefinition = { ...LEADS, id: "sales.hosted", execute: undefined }
        const registry = registryOf(
            [moduleOf("sales", [hosted], [actionOf("sales.hosted-action", { execute: undefined })])],
            [LEAD],
        )

        expect(registry.reads.size).toBe(0)
        expect(registry.actions.size).toBe(0)
    })

    it("takes the data kind of the list for the counts read of that list, even from another module", () => {
        const registry = registryOf([moduleOf("sales", [LEADS], []), moduleOf("reports", [COUNTS], [])], [LEAD])

        expect(registry.reads.get("sales.lead-counts")?.dataKind).toBe("lead")
    })

    it("keeps the own data kind of a counts read whose list is not declared", () => {
        const registry = registryOf([moduleOf("sales", [COUNTS], [])], [COUNTED])

        expect(registry.reads.get("sales.lead-counts")?.dataKind).toBe("counts")
    })

    it("accepts an entity port of a declared entity, and the door port on an action that is not transactional", () => {
        const action = actionOf("sales.notify", {
            ports: { leads: { entry: "port", id: "engine.entity.sales.lead" }, door: doorPort },
        })

        expect(registryOf([moduleOf("sales", [], [action])], [LEAD]).actions.has("sales.notify")).toBe(true)
    })
})

describe("registryOf at boot", () => {
    let registryOf: Subject["registryOf"]

    beforeAll(async () => {
        ;({ registryOf } = await build())
    })

    it("refuses two declarations that take one id", () => {
        const refusal = thrown(() =>
            registryOf([moduleOf("sales", [LEADS], []), moduleOf("again", [LEADS], [])], [LEAD]),
        )

        expect(refusal).toMatchObject({ code: WorkbenchDoorErrorCode.RegistryDuplicate, params: { id: "sales.leads" } })
    })

    it("refuses an id that is not module.name", () => {
        const refusal = thrown(() => registryOf([moduleOf("sales", [], [actionOf(MALFORMED)])], [LEAD]))

        expect(refusal).toMatchObject({ code: WorkbenchDoorErrorCode.RegistryIdInvalid, params: { id: MALFORMED } })
    })

    it("serves a package-qualified read <package>.<agent>.api.<domain>.<query> and action <package>.<agent>.<action> beside a module.name one", () => {
        const qualified = "blocks-core.sales.lead-move"
        const registry = registryOf([moduleOf("sales", [], [actionOf(qualified), actionOf("sales.move-stage")])], [LEAD])

        expect([...registry.actions.keys()]).toEqual([qualified, "sales.move-stage"])
    })

    it("refuses an id of four parts, which is neither an old-form id nor a qualified one", () => {
        const refusal = thrown(() => registryOf([moduleOf("sales", [], [actionOf("blocks-core.sales.lead.move")])], [LEAD]))

        expect(refusal).toMatchObject({
            code: WorkbenchDoorErrorCode.RegistryIdInvalid,
            params: { id: "blocks-core.sales.lead.move" },
        })
    })

    it("refuses a port nothing provides", () => {
        const action = actionOf("sales.price", { ports: { pricing: { entry: "port", id: "sales.pricing" } } })

        expect(thrown(() => registryOf([moduleOf("sales", [], [action])], [LEAD]))).toMatchObject({
            code: WorkbenchDoorErrorCode.RegistryPortUnknown,
            params: { id: "sales.price", port: "sales.pricing" },
        })
    })

    it("refuses a list read whose data kind no entity declares", () => {
        expect(thrown(() => registryOf([moduleOf("sales", [LEADS], [])], []))).toMatchObject({
            code: WorkbenchDoorErrorCode.RegistryEntityMissing,
            params: { id: "sales.leads", port: "sales.leads-list" },
        })
    })

    it("refuses an action that lists a list source, which has no data kind to resolve", () => {
        const action = actionOf("sales.page", { ports: { source: { entry: "port", id: "sales.leads-list" } } })

        expect(thrown(() => registryOf([moduleOf("sales", [], [action])], [LEAD]))).toMatchObject({
            code: WorkbenchDoorErrorCode.RegistryEntityMissing,
        })
    })

    it("refuses an entity port of an entity nobody declared", () => {
        const action = actionOf("sales.ghost", {
            ports: { ghosts: { entry: "port", id: "engine.entity.sales.ghost" } },
        })

        expect(thrown(() => registryOf([moduleOf("sales", [], [action])], [LEAD]))).toMatchObject({
            code: WorkbenchDoorErrorCode.RegistryEntityMissing,
        })
    })

    it("refuses a transactional action that lists the door, which calls out of the system", () => {
        const calling = actionOf("sales.notify", { transactional: true, ports: { door: doorPort } })

        expect(thrown(() => registryOf([moduleOf("sales", [], [calling])], [LEAD]))).toMatchObject({
            code: WorkbenchDoorErrorCode.ExternalInTx,
            params: { action: "sales.notify" },
        })
    })
})
