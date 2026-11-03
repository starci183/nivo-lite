import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GraphNodeEffectsService, ledgerKeyOf } from "./graph-node-effects.service"
import { GraphNodeEffectEntity } from "./persistence/entities"

const ROW = { workspaceId: "ws-1", ledgerKey: "call:run:0", effect: "core.send", subjectKind: "message", subjectId: "m-1" }

/** The stored row of the ledger, as the database answers it. */
const stored = (overrides: Partial<GraphNodeEffectEntity> = {}): GraphNodeEffectEntity =>
    Object.assign(new GraphNodeEffectEntity(), { id: "e-1", createdAt: new Date(0), updatedAt: new Date(0), ...ROW, ...overrides })

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeEffectsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(GraphNodeEffectsService), logger }
}

describe("ledgerKeyOf", () => {
    it("keys a call by its business key when it has one, else by the run step's own", () => {
        expect(ledgerKeyOf({ key: "run:0", dedupeKey: null })).toBe("call:run:0")
        expect(ledgerKeyOf({ key: "run:0", dedupeKey: "pay:o1" })).toBe("dedupe:pay:o1")
    })
})

describe("GraphNodeEffectsService.once", () => {
    it("acts once, writes the subject, and answers the row that won", async () => {
        const em = mockEntityManager({ findOneByOrFail: [GraphNodeEffectEntity, stored({ subjectId: "m-0" })] })
        em.findOneBy.mockResolvedValue(null)
        const [fake] = queueQueryBuilders(em, [{ execute: { raw: [] } }])
        const { service } = await build(em)
        const act = jest.fn().mockResolvedValue({ kind: "message", id: "m-1" })

        await expect(service.once("ws-1", "core.send", { key: "run:0", dedupeKey: null }, act)).resolves.toEqual({
            kind: "message",
            id: "m-0",
        })
        expect(act).toHaveBeenCalledTimes(1)
        expect(fake?.callsOf("values")).toEqual([[ROW]])
        expect(fake?.callsOf("orIgnore")).toEqual([[]])
    })

    it("answers the first subject of a key already written and acts no more", async () => {
        const em = mockEntityManager()
        em.findOneBy.mockResolvedValue(stored({ ledgerKey: "dedupe:pay:o1" }))
        const { service, logger } = await build(em)
        const act = jest.fn()

        await expect(service.once("ws-1", "core.send", { key: "run:0", dedupeKey: "pay:o1" }, act)).resolves.toEqual({
            kind: "message",
            id: "m-1",
        })
        expect(act).not.toHaveBeenCalled()
        expect(em.findOneBy).toHaveBeenCalledWith(GraphNodeEffectEntity, { workspaceId: "ws-1", ledgerKey: "dedupe:pay:o1" })
        expect(logger.info).toHaveBeenCalledWith("graph_nodes.effect_replayed", { workspaceId: "ws-1", effect: "core.send" })
    })
})
