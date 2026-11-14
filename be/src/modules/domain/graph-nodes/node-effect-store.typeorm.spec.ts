import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { TypeormNodeEffectStore } from "./node-effect-store.typeorm"
import type { EffectInsert } from "./node-effect-store.port"
import { NodeEffectEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"

const build = async () => {
    const em = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [TypeormNodeEffectStore, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { store: moduleRef.get(TypeormNodeEffectStore), em }
}

describe("TypeormNodeEffectStore insert", () => {
    it("writes the row through a builder that names its entity, and answers whether this call wrote it", async () => {
        const { store, em } = await build()
        queueQueryBuilders(em, [{ execute: { raw: [{ id: "e1" }] } }, { execute: { raw: [] } }])
        const effect: EffectInsert = {
            effectKey: "k1",
            effectId: "e1",
            subjectEntity: "order",
            subjectId: "o1",
            runId: "r1",
            stepKey: "s1",
            args: { a: 1 },
            facts: null,
        }

        await expect(store.insert(WS, effect)).resolves.toBe(true)
        await expect(store.insert(WS, effect)).resolves.toBe(false)

        expect(em.createQueryBuilder).toHaveBeenCalledWith(NodeEffectEntity, "effect")
    })
})
