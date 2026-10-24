import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "./primary.decorators"
import type { RateLimitRow } from "./persistence/rate-limit.rows"
import { RATE_LIMIT_CONSUME } from "./persistence/rate-limit.sql"
import { PostgresRateLimitStoreClient } from "./postgres-rate-limit-store.client"

const build = async (rows: ReadonlyArray<RateLimitRow> = [{ allowed: true }]) => {
    const manager = mockEntityManager({ query: [RATE_LIMIT_CONSUME, rows] })
    const moduleRef = await Test.createTestingModule({
        providers: [PostgresRateLimitStoreClient, { provide: PRIMARY_ENTITY_MANAGER, useValue: manager }],
    }).compile()
    return { store: moduleRef.get(PostgresRateLimitStoreClient), manager }
}

describe("PostgresRateLimitStoreClient", () => {
    it("consumes a request through one atomic statement on the primary database", async () => {
        const { store, manager } = await build()

        await expect(store.consume("default:127.0.0.1", 60_000, 600)).resolves.toBe(true)

        expect(manager.query.mock.calls).toEqual([[RATE_LIMIT_CONSUME, ["default:127.0.0.1", 60_000, 600]]])
    })

    it("returns the database's refusal", async () => {
        const { store } = await build([{ allowed: false }])

        await expect(store.consume("strict:127.0.0.1", 60_000, 30)).resolves.toBe(false)
    })

    it("refuses admission if the database returns no counter result", async () => {
        const { store } = await build([])

        await expect(store.consume("default:127.0.0.1", 60_000, 600)).resolves.toBe(false)
    })

    it("propagates a database failure", async () => {
        const { store, manager } = await build()
        const failure = new Error("database unavailable")
        manager.query.mockRejectedValue(failure)

        await expect(store.consume("default:127.0.0.1", 60_000, 600)).rejects.toBe(failure)
    })
})
