import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { InsertResult, IsNull } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { ADDRESS, FEE, deriveFactOf, derivedOf } from "@tests/fixtures/builders/policy-derive.builder"
import { BrainPolicyStoreService } from "./brain-policy-store.service"
import { BrainPolicyEntity } from "./persistence/entities"
import { basisOf } from "./policy-derive.policy"

const WS = "ws-1"

/** A stored row of a judgement. */
const rowOf = (fields: Partial<BrainPolicyEntity>): BrainPolicyEntity => Object.assign(new BrainPolicyEntity(), fields)

const build = async () => {
    const em = mockEntityManager()
    // The one query builder the store chains: select, update and insert forms answer with themselves.
    const chain = fakeQueryBuilder({ execute: Object.assign(new InsertResult(), { affected: 1 }) })
    em.createQueryBuilder.mockReturnValue(chain.builder)
    const moduleRef = await Test.createTestingModule({
        providers: [BrainPolicyStoreService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(BrainPolicyStoreService), em, chain }
}

describe("BrainPolicyStoreService: reads", () => {
    it("all: one read of the workspace's judgements, mapped", async () => {
        const { service, em } = await build()
        const stored = derivedOf(FEE)
        em.find.mockResolvedValue([rowOf({ ...stored })])

        await expect(service.all(WS)).resolves.toEqual([stored])

        expect(em.find).toHaveBeenCalledTimes(1)
        expect(em.find).toHaveBeenCalledWith(BrainPolicyEntity, { where: { workspaceId: WS }, take: 5000 })
    })

    it("ofTruth: one read by the truth's unique key; a shop-wide truth is the one with no instance", async () => {
        const { service, em } = await build()
        em.findOne.mockResolvedValue(null)

        await expect(service.ofTruth(WS, FEE)).resolves.toBeNull()
        await service.ofTruth(WS, deriveFactOf({ id: "own", installationId: "inst-1" }))

        expect(em.findOne).toHaveBeenNthCalledWith(1, BrainPolicyEntity, {
            where: { workspaceId: WS, subjectKey: FEE.subjectKey, attribute: FEE.attribute, installationId: IsNull() },
        })
        expect(em.findOne).toHaveBeenNthCalledWith(2, BrainPolicyEntity, {
            where: { workspaceId: WS, subjectKey: FEE.subjectKey, attribute: FEE.attribute, installationId: "inst-1" },
        })
    })

})

describe("BrainPolicyStoreService: writes", () => {
    it("save: a new truth is inserted and a repeated insert ignored; it stores the binding and never a value", async () => {
        const { service, chain } = await build()

        const stored = await service.save(WS, [
            {
                fact: FEE,
                known: null,
                judgement: { policy: true, title: "Delivery fee", group: "Delivery", reason: "The owner tunes it" },
                model: "claude-haiku-5-5",
            },
        ])

        expect(stored).toBe(1)
        expect(chain.callsOf("insert")).toHaveLength(1)
        expect(chain.callsOf("orIgnore")).toHaveLength(1)
        const [values] = chain.callsOf("values")[0] ?? []
        expect(values).toEqual({
            workspaceId: WS,
            subjectKey: FEE.subjectKey,
            attribute: FEE.attribute,
            installationId: null,
            factId: "fee",
            factVersion: 1,
            basis: basisOf(FEE),
            kind: "policy",
            title: "Delivery fee",
            groupKey: "delivery",
            groupLabel: "Delivery",
            valueType: "money",
            reason: "The owner tunes it",
            status: "open",
            model: "claude-haiku-5-5",
            retiredAt: null,
        })
        expect(values).not.toHaveProperty("value")
    })

    it("save: a truth judged before is amended in place, by the id of its row", async () => {
        const { service, chain } = await build()
        const known = derivedOf(ADDRESS)

        await service.save(WS, [
            { fact: ADDRESS, known, judgement: { policy: false, title: "", group: "", reason: "Contact data" }, model: "m" },
        ])

        expect(chain.callsOf("insert")).toHaveLength(0)
        expect(chain.callsOf("update")).toHaveLength(1)
        expect(chain.callsOf("set")[0]?.[0]).toMatchObject({ kind: "not_policy", title: "", groupKey: "", status: "open" })
        expect(chain.callsOf("where")).toContainEqual([{ workspaceId: WS, id: known.id }])
    })

    it("rebind: each judgement follows its truth to the fact that holds it, and stands again", async () => {
        const { service, em } = await build()
        em.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] })

        await service.rebind(WS, [{ id: "p-fee", factId: "fee-v2", factVersion: 2, valueType: "money" }])

        expect(em.update).toHaveBeenCalledWith(
            BrainPolicyEntity,
            { workspaceId: WS, id: "p-fee" },
            { factId: "fee-v2", factVersion: 2, valueType: "money", status: "open", retiredAt: null },
        )
    })

    it("retire: one statement for the open rows named; nothing for an empty list", async () => {
        const { service, em, chain } = await build()

        await service.retire(WS, [])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()

        await service.retire(WS, ["p-fee", "p-hours"])
        expect(chain.callsOf("execute")).toHaveLength(1)
        expect(chain.callsOf("set")[0]?.[0]).toMatchObject({ status: "retired" })
    })
})
