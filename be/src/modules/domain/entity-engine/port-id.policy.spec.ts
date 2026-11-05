import { Test } from "@nestjs/testing"
import { entityOfPortId, entityPortId } from "./port-id.policy"

const PORT_ID: unique symbol = Symbol("entity-engine.port-id")

interface PortIdPolicy {
    readonly entityOfPortId: typeof entityOfPortId
    readonly entityPortId: typeof entityPortId
}

const build = async (): Promise<PortIdPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: PORT_ID, useFactory: (): PortIdPolicy => ({ entityOfPortId, entityPortId }) }],
    }).compile()
    return moduleRef.get<PortIdPolicy>(PORT_ID)
}

describe("port ids", () => {
    it("names the port of an entity and reads the entity back from the id", async () => {
        const policy = await build()

        expect(policy.entityPortId("sales.lead")).toBe("engine.entity.sales.lead")
        expect(policy.entityOfPortId("engine.entity.sales.lead")).toBe("sales.lead")
    })

    it.each(["engine.entities", "engine.outbox", "engine.entity.", "other.sales.lead"])(
        "reads no entity from the id %p",
        async (id) => {
            const policy = await build()

            expect(policy.entityOfPortId(id)).toBeNull()
        },
    )
})
