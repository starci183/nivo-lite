import { Test } from "@nestjs/testing"
import { mock, mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, type Logger } from "@modules/platform/logging"
import type { AccountDataTypeDef } from "./account-data.contracts"
import { MAX_SWEEP_BATCHES } from "./account-data.policy"
import { ACCOUNT_DATA_OPTIONS } from "./account-data.port"
import { AccountDataRetentionService } from "./account-data-retention.service"
import { AccountDataTypesService } from "./account-data-types.service"
import { AccountDataError, AccountDataErrorCode } from "./errors/account-data.error"
import { AccountDataEntity } from "./persistence/entities"

const FIELDS = { id: { type: "text", required: true } } as const

const update: AccountDataTypeDef = {
    name: "telegram.update",
    provider: "telegram",
    version: 1,
    write: "append",
    fields: FIELDS,
    key: ["id"],
    wakes: true,
    retention: { days: 30 },
}
const delivery: AccountDataTypeDef = {
    ...update,
    name: "webhook.delivery",
    provider: "webhook",
    wakes: false,
    retention: { days: 7 },
}
const snapshot: AccountDataTypeDef = {
    name: "interface.snapshot",
    provider: null,
    version: 1,
    write: "overwrite",
    fields: FIELDS,
    key: ["id"],
    ttlMs: 60_000,
    retention: "keep",
}
const message: AccountDataTypeDef = { ...update, name: "telegram.message", wakes: false, retention: "keep" }

/** The statement of one batch of a type. */
const statementOf = (processedOnly: boolean): string =>
    "(type, id) IN (SELECT old.type, old.id FROM public.account_data old " +
    "WHERE old.type = :type AND old.occurred_at < now() - make_interval(secs => CAST(:seconds AS double precision)) " +
    (processedOnly ? "AND old.processed_at IS NOT NULL " : "") +
    "ORDER BY old.occurred_at LIMIT :batch)"

/** A manager whose deletes answer the counts in order. */
const build = async (types: ReadonlyArray<AccountDataTypeDef>, ...deleted: Array<number | undefined>) => {
    const em = mockEntityManager()
    const fakes = queueQueryBuilders(
        em,
        deleted.map((affected) => ({ execute: { affected, raw: [] } })),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountDataRetentionService,
            AccountDataTypesService,
            { provide: ACCOUNT_DATA_OPTIONS, useValue: { types } },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return { retention: moduleRef.get(AccountDataRetentionService), em, fakes }
}

const fenced = () => jest.fn(() => Promise.resolve())

describe("AccountDataRetentionService.sweep", () => {
    it("sweeps each declared type by its own rule, in type order, and answers the total", async () => {
        const { retention, em, fakes } = await build([update, delivery, snapshot, message], 1, 2, 3)
        const beforeBatch = fenced()

        await expect(retention.sweep({ batch: 100 }, beforeBatch)).resolves.toBe(6)

        expect(em.createQueryBuilder).toHaveBeenCalledWith(AccountDataEntity, "r")
        expect(fakes.map((fake) => fake.callsOf("where"))).toEqual([
            [[statementOf(false), { type: "interface.snapshot", seconds: 60, batch: 100 }]],
            [[statementOf(true), { type: "telegram.update", seconds: 30 * 86_400, batch: 100 }]],
            [[statementOf(false), { type: "webhook.delivery", seconds: 7 * 86_400, batch: 100 }]],
        ])
        expect(beforeBatch).toHaveBeenCalledTimes(3)
    })

    it("never deletes a pending row of a wakes type: only its statement asks for a processed row", async () => {
        const { retention, fakes } = await build([update, delivery], 0, 0)

        await retention.sweep({}, fenced())

        expect(String(fakes[0]?.callsOf("where")[0]?.[0])).toContain("old.processed_at IS NOT NULL")
        expect(String(fakes[1]?.callsOf("where")[0]?.[0])).not.toContain("processed_at")
    })

    it("never touches a type kept for good", async () => {
        const { retention, em } = await build([message])

        await expect(retention.sweep({}, fenced())).resolves.toBe(0)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("runs the next batch while batches come back full, with the default batch of 1000", async () => {
        const { retention, fakes } = await build([delivery], 1000, 1000, 4)
        const beforeBatch = fenced()

        await expect(retention.sweep(null, beforeBatch)).resolves.toBe(2004)
        expect(fakes).toHaveLength(3)
        expect(fakes[0]?.callsOf("where")[0]?.[1]).toMatchObject({ batch: 1000 })
        expect(beforeBatch).toHaveBeenCalledTimes(3)
    })

    it("stops a type at its batch budget; the next pass continues", async () => {
        const full = Array.from({ length: MAX_SWEEP_BATCHES + 1 }, () => 10)
        const { retention, em } = await build([delivery], ...full)

        await expect(retention.sweep({ batch: 10 }, fenced())).resolves.toBe(10 * MAX_SWEEP_BATCHES)
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(MAX_SWEEP_BATCHES)
    })

    it("asks the fence before every batch and stops when it refuses", async () => {
        const { retention, em } = await build([delivery], 5)
        const refusal = new AccountDataError({ code: AccountDataErrorCode.WriteMode })
        const lost = jest.fn((): Promise<void> => {
            throw refusal
        })

        await expect(retention.sweep({}, lost)).rejects.toBe(refusal)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("counts a statement that answers no count as nothing deleted", async () => {
        const { retention } = await build([delivery], undefined)

        await expect(retention.sweep({}, fenced())).resolves.toBe(0)
    })
})
