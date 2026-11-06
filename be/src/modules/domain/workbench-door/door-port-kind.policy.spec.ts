import { Test } from "@nestjs/testing"
import { portKindOf as realPortKindOf } from "./door-port-kind.policy"

const SUBJECT = Symbol("door-port-kind.policy")

interface Subject {
    readonly portKindOf: typeof realPortKindOf
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { portKindOf: realPortKindOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("portKindOf", () => {
    let portKindOf: Subject["portKindOf"]

    beforeAll(async () => {
        ;({ portKindOf } = await build())
    })

    it.each([
        ["engine.entities", "engine"],
        ["engine.entity.sales.lead", "engine"],
        ["engine.outbox", "engine"],
        ["sales.leads-list", "list"],
        ["inventory.items-list", "list"],
        ["platform.installation", "installation"],
        ["platform.members", "members"],
        ["platform.rights", "rights"],
        ["platform.agent-connections", "agent-connections"],
        ["platform.agent-knowledge", "agent-knowledge"],
        ["platform.parked-runs", "parked-runs"],
        ["engine.door", "door"],
        ["sales.pricing", "none"],
        ["engine.entity.", "none"],
    ])("serves %s as %s", (id, kind) => {
        expect(portKindOf(id)).toBe(kind)
    })
})
