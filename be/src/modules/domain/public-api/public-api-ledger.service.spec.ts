import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import { ledgerExpected, ledgerWritten } from "@tests/fixtures/builders/public-api-ledger.builder"
import { PublicApiEntity } from "./persistence/entities"
import { PublicApiLedgerService } from "./public-api-ledger.service"

const WORKSPACE = "workspace-1"
const REQUEST = "request-1"
const RECORD = {
    workspaceId: WORKSPACE,
    keyId: "key-1",
    kind: "lead" as const,
    prefix: "lead:key-1:",
    suffix: "crm-9",
    body: { name: "A" },
    needSupplied: true,
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [PublicApiLedgerService] }).compile()
    return moduleRef.get(PublicApiLedgerService)
}

describe("PublicApiLedgerService / record", () => {
    it("records the request once per dedupe key and answers the row it wrote", async () => {
        const em = mockEntityManager()
        const write = fakeQueryBuilder({ execute: { raw: [{ id: REQUEST, lead_id: null, inserted: true }] } })
        answerQueryBuilders(em, write)

        await expect((await build()).record(RECORD, em)).resolves.toEqual({
            id: REQUEST,
            lead_id: null,
            inserted: true,
        })

        expect(em.createQueryBuilder).toHaveBeenCalledWith(PublicApiEntity, "public_api")

        expect(write.callsOf("insert")).toEqual([[]])
        expect(ledgerWritten(write)).toEqual(ledgerExpected(RECORD))
        expect(evaluatedValues(write.argsOf("values")[0]?.[0])).toMatchObject({
            dedupeKey: "(:prefix::text || COALESCE(NULLIF(:suffix::text, ''), gen_random_uuid()::text))",
        })
    })

    it("answers the row of an earlier identical request as not inserted", async () => {
        const em = mockEntityManager()
        answerQueryBuilders(
            em,
            fakeQueryBuilder({ execute: { raw: [{ id: REQUEST, lead_id: "lead-2", inserted: false }] } }),
        )

        await expect((await build()).record(RECORD, em)).resolves.toEqual({
            id: REQUEST,
            lead_id: "lead-2",
            inserted: false,
        })
    })

    it("stores an absent need presence as null and answers nothing when the insert returns no row", async () => {
        const em = mockEntityManager()
        const write = fakeQueryBuilder({ execute: { raw: [] } })
        answerQueryBuilders(em, write)

        const { workspaceId, keyId, kind, prefix, suffix, body } = RECORD
        await expect(
            (await build()).record({ workspaceId, keyId, kind, prefix, suffix, body }, em),
        ).resolves.toBeUndefined()

        expect(write.argsOf("values")[0]?.[0]).toMatchObject({ needSupplied: null })
    })
})

describe("PublicApiLedgerService / lock, complete and link", () => {
    it("locks only the request of this workspace for update", async () => {
        const row = Object.assign(new PublicApiEntity(), { id: REQUEST })
        const em = mockEntityManager({ findOne: [PublicApiEntity, row] })

        await expect((await build()).lock(WORKSPACE, REQUEST, em)).resolves.toBe(row)

        expect(em.findOne).toHaveBeenCalledWith(PublicApiEntity, {
            where: { workspaceId: WORKSPACE, id: REQUEST },
            lock: { mode: "pessimistic_write" },
        })
    })

    it("completes an unprocessed request and keeps the known customer when none is resolved", async () => {
        const em = mockEntityManager()
        const update = fakeQueryBuilder({ execute: {} })
        answerQueryBuilders(em, update)

        await (await build()).complete(WORKSPACE, REQUEST, null, em)

        expect(em.createQueryBuilder).toHaveBeenCalledWith(PublicApiEntity, "p")

        expect(update.callsOf("update")).toEqual([[]])
        expect(evaluatedValues(update.argsOf("set")[0]?.[0])).toEqual({
            processedAt: "now()",
            leadId: "COALESCE(:leadId::uuid, lead_id)",
        })
        expect(update.argsOf("where")).toEqual([
            [
                "workspace_id = :workspaceId AND id = :requestId AND processed_at IS NULL",
                { workspaceId: WORKSPACE, requestId: REQUEST },
            ],
        ])
        expect(update.argsOf("setParameter")).toEqual([["leadId", null]])
    })

    it("links the customer to a lead request of the workspace", async () => {
        const em = mockEntityManager({ update: [PublicApiEntity, { affected: 1 }] })

        await (await build()).linkLead(WORKSPACE, REQUEST, "lead-1", em)

        expect(em.update).toHaveBeenCalledWith(
            PublicApiEntity,
            { workspaceId: WORKSPACE, id: REQUEST, kind: "lead" },
            { leadId: "lead-1" },
        )
    })
})
