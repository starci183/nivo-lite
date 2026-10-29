import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { builderOf, queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { RenewalCashFacts } from "./renewal-cash.contracts"
import { RenewalCashService } from "./renewal-cash.service"
import type { RenewalCashQuery } from "./renewal-cash.service"

const WS = "ws-1"
const FROM = new Date("2026-10-26T17:00:00.000Z")
const TO = new Date("2026-10-27T17:00:00.000Z")

const queryOf = builder<RenewalCashQuery>({
    workspaceId: WS,
    from: FROM,
    to: TO,
    day: "2026-10-27",
    horizonDay: "2026-11-26",
    bound: 20,
})

const factsOf = builder<RenewalCashFacts>({
    issued_count: 3,
    issued_total: 1_500_000,
    issued: [{ invoice_no: "INV-1", amount_vnd: 500_000, customer_name: "Truong Phat" }],
    paid_count: 1,
    paid_total: 500_000,
    paid: [
        { invoice_no: "INV-2", amount_vnd: 500_000, customer_name: "Hoa Mai", ends_on: "2027-11-29", extended: true },
    ],
    unpaid_count: 2,
    unpaid_total: 900_000,
    unpaid: [{ invoice_no: "INV-3", amount_vnd: 900_000, customer_name: null, due_on: "2026-11-01" }],
    expiring_count: 4,
    expiring_total: 0,
    expiring: [{ customer_name: "Lan Anh", plan: null, ends_on: "2026-11-05", amount_vnd: null }],
    unmatched_count: 1,
    unmatched_total: 100_000,
    unmatched: [{ amount_vnd: 100_000, sender_name: null, memo: "CK" }],
})

/** What the ten statements answer, in the order the reader runs them: a tally then a list for each part of the story. */
const answersOf = (row: RenewalCashFacts | undefined): ReadonlyArray<QueryBuilderAnswers> => [
    { getRawOne: row && { count: row.issued_count, total: row.issued_total } },
    { getRawMany: row?.issued ?? [] },
    { getRawOne: row && { count: row.paid_count, total: row.paid_total } },
    { getRawMany: row?.paid ?? [] },
    { getRawOne: row && { count: row.unpaid_count, total: row.unpaid_total } },
    { getRawMany: row?.unpaid ?? [] },
    { getRawOne: row && { count: row.expiring_count, total: row.expiring_total } },
    { getRawMany: row?.expiring ?? [] },
    { getRawOne: row && { count: row.unmatched_count, total: row.unmatched_total } },
    { getRawMany: row?.unmatched ?? [] },
]

const build = async (row: RenewalCashFacts | undefined) => {
    const entityManager = mockEntityManager()
    const tx = fakeTransaction(entityManager)
    const statements = queueQueryBuilders(entityManager, answersOf(row))
    const moduleRef = await Test.createTestingModule({
        providers: [RenewalCashService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(RenewalCashService), entityManager, tx, statements }
}

/** A chainable sub-query whose every method answers itself and whose `getQuery` answers `text`. */
const chainOf = (text: string): object => {
    const chain: Record<string, unknown> = { getQuery: () => text }
    for (const method of ["subQuery", "select", "from", "where", "andWhere"]) chain[method] = () => chain
    return chain
}

/** Whether an `andWhere` argument is the callback that builds the exclusion of contracts that have a renewal invoice. */
const isExclusion = (value: unknown): value is (outer: never) => string => typeof value === "function"

describe("RenewalCashService", () => {
    it("reads every part of the story in one repeatable-read snapshot", async () => {
        const { service, entityManager, tx } = await build(factsOf())

        await expect(service.read(queryOf())).resolves.toEqual(factsOf())

        expect(entityManager.transaction).toHaveBeenCalledWith("REPEATABLE READ", expect.any(Function))
        expect(tx.commits).toBe(1)
    })

    it("scopes each statement to the workspace, the window, the horizon and the first day", async () => {
        const { service, statements } = await build(factsOf())

        await service.read(queryOf())

        expect(statements[0]?.callsOf("where")).toEqual([["i.workspace_id = :workspaceId", { workspaceId: WS }]])
        expect(statements[0]?.callsOf("andWhere")).toContainEqual([
            "i.issued_at >= :from AND i.issued_at < :to",
            { from: FROM, to: TO },
        ])
        expect(statements[2]?.callsOf("andWhere")).toContainEqual([
            "i.paid_at >= :from AND i.paid_at < :to",
            { from: FROM, to: TO },
        ])
        expect(statements[4]?.callsOf("andWhere")).toContainEqual([
            "i.due_at < (:horizonDay::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'",
            { horizonDay: "2026-11-26" },
        ])
        expect(statements[6]?.callsOf("andWhere")).toContainEqual([
            "c.ends_on >= :day::date AND c.ends_on <= :horizonDay::date",
            { day: "2026-10-27", horizonDay: "2026-11-26" },
        ])
        expect(statements[8]?.callsOf("where")).toEqual([
            [
                "e.workspace_id = :workspaceId AND e.kind = 'payment' AND e.status = 'needs_decision'",
                { workspaceId: WS },
            ],
        ])
    })

    it("bounds every list by the query and orders it", async () => {
        const { service, statements } = await build(factsOf())

        await service.read(queryOf({ bound: 7 }))

        const lists = statements.filter((_, index) => index % 2 === 1)
        expect(lists.map((one) => one.callsOf("limit"))).toEqual(Array.from({ length: 5 }, () => [[7]]))
        expect(lists[0]?.callsOf("orderBy")).toEqual([["i.issued_at", "ASC"]])
        expect(lists[0]?.callsOf("addOrderBy")).toEqual([["i.invoice_no", "ASC"]])
        expect(lists[4]?.callsOf("addOrderBy")).toEqual([])
    })
})

describe("RenewalCashService expiring contracts", () => {
    it("leaves out of the expiring contracts those with a renewal invoice for their period", async () => {
        const { service, statements } = await build(factsOf())
        await service.read(queryOf())
        const exclusion = statements[6]?.callsOf("andWhere").at(-1)?.[0]
        const subquery = chainOf("(select 1 from invoices)")

        const where = isExclusion(exclusion) ? exclusion(builderOf(subquery)) : ""

        expect(where).toBe("NOT EXISTS (select 1 from invoices)")
    })

    it("tells an empty story when the statements answer no row", async () => {
        const { service } = await build(undefined)

        await expect(service.read(queryOf())).resolves.toEqual(
            factsOf({
                issued_count: 0,
                issued_total: 0,
                issued: [],
                paid_count: 0,
                paid_total: 0,
                paid: [],
                unpaid_count: 0,
                unpaid_total: 0,
                unpaid: [],
                expiring_count: 0,
                expiring_total: 0,
                expiring: [],
                unmatched_count: 0,
                unmatched_total: 0,
                unmatched: [],
            }),
        )
    })
})
