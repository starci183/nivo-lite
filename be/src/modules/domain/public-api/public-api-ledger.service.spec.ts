import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import { ledgerAnswers, ledgerExpected, ledgerWritten } from "@tests/fixtures/builders/public-api-ledger.builder"
import { PublicApiEntity } from "./persistence/entities"
import { PublicApiLedgerService } from "./public-api-ledger.service"

const WORKSPACE = "workspace-1"
const REQUEST = "request-1"
const RECORD = {
    workspaceId: WORKSPACE,
    keyId: "key-1",
    kind: "message" as const,
    prefix: "message:key-1:",
    suffix: "crm-9",
    body: { text: "A" },
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [PublicApiLedgerService] }).compile()
    return moduleRef.get(PublicApiLedgerService)
}

describe("PublicApiLedgerService / record", () => {
    it("records the request once per dedupe key and answers the row it wrote", async () => {
        const em = mockEntityManager()
        const write = fakeQueryBuilder({ execute: { raw: [{ id: REQUEST, inserted: true }] } })
        answerQueryBuilders(em, write)

        await expect((await build()).record(RECORD, em)).resolves.toEqual({ id: REQUEST, inserted: true })

        expect(em.createQueryBuilder).toHaveBeenCalledWith(PublicApiEntity, "public_api")

        expect(write.callsOf("insert")).toEqual([[]])
        expect(ledgerWritten(write)).toEqual(ledgerExpected(RECORD))
        expect(evaluatedValues(write.argsOf("values")[0]?.[0])).toMatchObject({
            dedupeKey: "(:prefix::text || COALESCE(NULLIF(:suffix::text, ''), gen_random_uuid()::text))",
        })
    })

    it("answers nothing when the insert and the count return no row", async () => {
        const em = mockEntityManager()
        answerQueryBuilders(em, fakeQueryBuilder({ execute: { raw: [] } }), fakeQueryBuilder({ execute: { raw: [] } }))

        await expect((await build()).record(RECORD, em)).resolves.toBeUndefined()
    })

    it("answers the row of an earlier identical request as not inserted", async () => {
        const em = mockEntityManager()
        const repeat = ledgerAnswers([{ id: REQUEST, inserted: false }])
        answerQueryBuilders(em, ...repeat.builders)

        await expect((await build()).record(RECORD, em)).resolves.toEqual({ id: REQUEST, inserted: false })
    })

    it("counts the repeat against the dedupe key of the prefix and the suffix", async () => {
        const em = mockEntityManager()
        const repeat = ledgerAnswers([{ id: REQUEST, inserted: false }])
        answerQueryBuilders(em, ...repeat.builders)

        await (await build()).record(RECORD, em)

        const [, count] = repeat.builders
        expect(count?.argsOf("where")).toEqual([[{ workspaceId: WORKSPACE, dedupeKey: "message:key-1:crm-9" }]])
        expect(evaluatedValues(count?.argsOf("set")[0]?.[0])).toEqual({ duplicates: "duplicates + 1" })
    })
})

describe("PublicApiLedgerService / lock and complete", () => {
    it("locks only the request of this workspace for update", async () => {
        const row = Object.assign(new PublicApiEntity(), { id: REQUEST })
        const em = mockEntityManager({ findOne: [PublicApiEntity, row] })

        await expect((await build()).lock(WORKSPACE, REQUEST, em)).resolves.toBe(row)

        expect(em.findOne).toHaveBeenCalledWith(PublicApiEntity, {
            where: { workspaceId: WORKSPACE, id: REQUEST },
            lock: { mode: "pessimistic_write" },
        })
    })

    it("completes an unprocessed request", async () => {
        const em = mockEntityManager()
        const update = fakeQueryBuilder({ execute: {} })
        answerQueryBuilders(em, update)

        await (await build()).complete(WORKSPACE, REQUEST, em)

        expect(em.createQueryBuilder).toHaveBeenCalledWith(PublicApiEntity, "p")

        expect(update.callsOf("update")).toEqual([[]])
        expect(evaluatedValues(update.argsOf("set")[0]?.[0])).toEqual({ processedAt: "now()" })
        expect(update.argsOf("where")).toEqual([
            [
                "workspace_id = :workspaceId AND id = :requestId AND processed_at IS NULL",
                { workspaceId: WORKSPACE, requestId: REQUEST },
            ],
        ])
    })
})
