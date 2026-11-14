import { Test } from "@nestjs/testing"
import { builder, fakeIds, fakeTransaction, FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { IDS } from "@modules/platform/ids"
import { isRecord } from "@modules/platform/primitives"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { EngineFailureService } from "./engine-failure.service"
import { ENTITY_ENGINE_OPTIONS } from "./entity-engine.decorators"
import type { EntityEngineOptions } from "./entity-engine.options"
import { EntityEngineService } from "./entity-engine.service"
import { EntityMutationService } from "./entity-mutation.service"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { RecordEntity } from "./persistence/entities"
import { mintScopedTx } from "./policies/scoped-tx.policy"

/** Matches the soft-delete guard TypeORM's `IsNull()` puts on `deletedAt`. */
const IS_NULL: unknown = expect.objectContaining({ _type: "isNull" })

const WS = "11111111-1111-4111-8111-111111111111"
const AGENT = "22222222-2222-4222-8222-222222222222"

const ORDER: EntityDefinition = {
    entry: "entity",
    name: "blocks-core.sales.order",
    dataKind: "sales-order",
    fields: { receipt: { kind: "file", nullable: true, accept: ["image/*"], maxBytes: 1000 } },
}
const LEAD: EntityDefinition = { entry: "entity", name: "blocks-core.sales.lead", dataKind: "sales-lead", fields: {} }
const ENTITIES = [ORDER, LEAD]

const whereEntityOf = (options: unknown): unknown =>
    isRecord(options) && isRecord(options["where"]) ? options["where"]["entity"] : undefined

const row = (entity: string, id: string, data: Record<string, unknown> = {}): RecordEntity =>
    Object.assign(new RecordEntity(), { entity, id, workspaceId: WS, agentId: AGENT, data })

const build = async (em: MockEntityManager) => {
    fakeTransaction(em)
    const engine = mock<EntityEngineService>({ catalog: new Map(ENTITIES.map((entity) => [entity.name, entity])) })
    engine.scoped.mockImplementation((workspaceId, work) => work(mintScopedTx({ manager: em, workspaceId })))
    engine.within.mockImplementation((manager, workspaceId, work) => work(mintScopedTx({ manager, workspaceId })))
    const moduleRef = await Test.createTestingModule({
        providers: [
            EntityMutationService,
            { provide: EntityEngineService, useValue: engine },
            { provide: EngineFailureService, useValue: mock<EngineFailureService>() },
            {
                provide: ENTITY_ENGINE_OPTIONS,
                useValue: builder<EntityEngineOptions>({
                    entities: ENTITIES,
                    jobs: [],
                    cursorKey: new Secret("a2V5"),
                })(),
            },
            { provide: CLOCK, useValue: new FakeClock(new Date("2026-11-13T10:00:00.000Z")) },
            { provide: IDS, useValue: fakeIds() },
        ],
    }).compile()
    return { mutations: moduleRef.get(EntityMutationService), engine }
}

describe("EntityMutationService.eraseForAgent: an agent's records are soft-deleted with its removal", () => {
    it("soft-deletes every live record of the agent in one transaction of the workspace, removes nothing and hands back no file", async () => {
        const em = mockEntityManager()
        em.find.mockImplementation((_target, options) => {
            const entity = whereEntityOf(options)
            return Promise.resolve(
                entity === ORDER.name
                    ? [row(ORDER.name, "o-1", { receipt: { key: "k-1", mime: "image/png", size: 5, name: "r.png" } })]
                    : [row(LEAD.name, "l-1"), row(LEAD.name, "l-2")],
            )
        })
        const updates = queueQueryBuilders(em, [{ execute: { affected: 1 } }, { execute: { affected: 2 } }])
        const { mutations, engine } = await build(em)

        await expect(mutations.eraseForAgent(WS, AGENT)).resolves.toEqual({ erased: 3, files: [] })

        expect(engine.scoped).toHaveBeenCalledTimes(1)
        expect(engine.scoped.mock.calls[0]?.[0]).toBe(WS)
        expect(engine.scoped.mock.calls[0]?.[2]).toBeUndefined()
        expect(updates.flatMap((fake) => fake.callsOf("where"))).toEqual([
            [{ entity: ORDER.name, workspaceId: WS, id: In(["o-1"]), deletedAt: IS_NULL }],
            [{ entity: LEAD.name, workspaceId: WS, id: In(["l-1", "l-2"]), deletedAt: IS_NULL }],
        ])
        expect(em.delete).not.toHaveBeenCalled()
    })

    it("joins the caller's own transaction when it is given one, so the records go (or stay) with the removal that asked", async () => {
        const em = mockEntityManager()
        em.find.mockResolvedValue([])
        const callers = mockEntityManager()
        callers.find.mockImplementation((_target, options) =>
            Promise.resolve(whereEntityOf(options) === LEAD.name ? [row(LEAD.name, "l-1")] : []),
        )
        queueQueryBuilders(callers, [{ execute: { affected: 1 } }])
        const { mutations, engine } = await build(em)

        await expect(mutations.eraseForAgent(WS, AGENT, callers)).resolves.toEqual({ erased: 1, files: [] })

        expect(engine.within).toHaveBeenCalledTimes(1)
        expect(engine.within.mock.calls[0]?.[0]).toBe(callers)
        expect(engine.within.mock.calls[0]?.[1]).toBe(WS)
        expect(engine.scoped).not.toHaveBeenCalled()
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(callers.delete).not.toHaveBeenCalled()
    })

    it("writes nothing for an agent that owns no live record", async () => {
        const em = mockEntityManager()
        em.find.mockResolvedValue([])
        const { mutations } = await build(em)

        await expect(mutations.eraseForAgent(WS, AGENT)).resolves.toEqual({ erased: 0, files: [] })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(em.delete).not.toHaveBeenCalled()
    })
})
