import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { cursorScopeOf } from "@nivo-lite/agent-sdk/query"
import type { Query } from "@nivo-lite/agent-sdk/query"
import type { EntitiesApi } from "./entity-engine.contracts"
import { entityApiOf, listScopeOf } from "./entity-port.policy"

const ENTITY_PORT: unique symbol = Symbol("entity-engine.entity-port")

interface EntityPortPolicy {
    readonly entityApiOf: typeof entityApiOf
    readonly listScopeOf: typeof listScopeOf
}

const build = async (): Promise<EntityPortPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: ENTITY_PORT, useFactory: (): EntityPortPolicy => ({ entityApiOf, listScopeOf }) }],
    }).compile()
    return moduleRef.get<EntityPortPolicy>(ENTITY_PORT)
}

const QUERY: Query = {
    from: "sales.lead",
    select: ["contactName"],
    where: { op: "eq", field: "stage", value: "new" },
    order: [["id", "asc"]],
    page: { size: 20 },
}

describe("listScopeOf", () => {
    it("binds the cursor to the entity, the condition and the order", async () => {
        const policy = await build()

        expect(policy.listScopeOf(QUERY)).toBe(
            cursorScopeOf(
                "sales.lead",
                { where: JSON.stringify({ op: "eq", field: "stage", value: "new" }) },
                JSON.stringify([["id", "asc"]]),
            ),
        )
    })

    it("tells a list with a condition from one without", async () => {
        const policy = await build()
        const { where: _where, ...open } = QUERY

        expect(policy.listScopeOf(open)).not.toBe(policy.listScopeOf(QUERY))
    })
})

describe("entityApiOf", () => {
    it("applies the entity name to every call of the multi-entity handle", async () => {
        const policy = await build()
        const api = mock<EntitiesApi>()
        const entity = policy.entityApiOf(api, "sales.lead")
        const { from: _from, ...tree } = QUERY

        await entity.get("id-1")
        await entity.list(tree)
        await entity.aggregate({ measures: { all: { kind: "count" } }, limit: 5 })
        await entity.insert({ contactName: "An" }, { owner: "id-2" })
        await entity.update("id-1", "3", { stage: "won" })
        await entity.upsert("phone_taken", { phone: "0900" })
        await entity.ensure("byPhone", { phone: "0900" })
        await entity.delete("id-1", "3")
        await entity.link("id-1", "owner", "id-2")
        await entity.unlink("id-1", "owner", "id-2")

        expect(api.get).toHaveBeenCalledWith("sales.lead", "id-1")
        expect(api.list).toHaveBeenCalledWith(QUERY)
        expect(api.aggregate).toHaveBeenCalledWith({
            from: "sales.lead",
            measures: { all: { kind: "count" } },
            limit: 5,
        })
        expect(api.insert).toHaveBeenCalledWith("sales.lead", { contactName: "An" }, { owner: "id-2" })
        expect(api.update).toHaveBeenCalledWith("sales.lead", "id-1", "3", { stage: "won" })
        expect(api.upsert).toHaveBeenCalledWith("sales.lead", "phone_taken", { phone: "0900" })
        expect(api.ensure).toHaveBeenCalledWith("sales.lead", "byPhone", { phone: "0900" })
        expect(api.delete).toHaveBeenCalledWith("sales.lead", "id-1", "3")
        expect(api.link).toHaveBeenCalledWith("sales.lead", "id-1", "owner", "id-2")
        expect(api.unlink).toHaveBeenCalledWith("sales.lead", "id-1", "owner", "id-2")
    })
})
