import { Test } from "@nestjs/testing"
import { entityOfPortId } from "./port-id.policy"

const PORT_ID: unique symbol = Symbol("entity-engine.port-id")

interface PortIdPolicy {
    readonly entityOfPortId: typeof entityOfPortId
}

const build = async (): Promise<PortIdPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: PORT_ID, useFactory: (): PortIdPolicy => ({ entityOfPortId }) }],
    }).compile()
    return moduleRef.get<PortIdPolicy>(PORT_ID)
}

describe("port ids", () => {
    it("reads the entity from the id of its port", async () => {
        const policy = await build()

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
