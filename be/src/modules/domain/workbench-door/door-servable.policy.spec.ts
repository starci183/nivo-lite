import { Test } from "@nestjs/testing"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { servableModulesOf as realServableModulesOf } from "./door-servable.policy"
import { WorkbenchDoorErrorCode } from "./errors/workbench-door.error"

const SUBJECT = Symbol("door-servable.policy")

interface Subject {
    readonly servableModulesOf: typeof realServableModulesOf
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { servableModulesOf: realServableModulesOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const actionOf = (id: ActionDefinition["id"], port: PortDefinition<unknown>["id"]): ActionDefinition => ({
    entry: "action",
    id,
    operation: id,
    permission: "x.manage",
    label: { key: "x.label" },
    ports: { thing: { entry: "port", id: port } },
    execute: () => Promise.resolve({ ok: true }),
})

const moduleOf = (key: string, actions: ReadonlyArray<ActionDefinition>): ModuleDeclaration => ({
    entry: "module",
    key,
    namespace: key,
    permissions: ["x.manage"],
    reads: [],
    actions,
    specs: [],
})

const SERVED = moduleOf("platform", [actionOf("platform.look", "platform.installation")])
const OWN_PORT = moduleOf("accounting", [actionOf("accounting.adjust", "accounting.book-entries")])
const NO_ENTITY = moduleOf("sales", [actionOf("sales.move", "engine.entity.sales.lead")])
const MALFORMED = moduleOf("bad", [actionOf("Bad.Thing", "platform.installation")])

describe("servableModulesOf", () => {
    let servableModulesOf: Subject["servableModulesOf"]

    beforeAll(async () => {
        ;({ servableModulesOf } = await build())
    })

    it("keeps a module whose ports the door provides", () => {
        expect(servableModulesOf([SERVED], [])).toEqual([SERVED])
    })

    it("leaves out a module that lists a port of its own, and one that names an entity nobody declared", () => {
        expect(servableModulesOf([OWN_PORT, SERVED, NO_ENTITY], [])).toEqual([SERVED])
    })

    it("lets any other fault of a module stop the start", () => {
        expect(() => servableModulesOf([MALFORMED], [])).toThrow(WorkbenchDoorErrorCode.RegistryIdInvalid)
    })
})
