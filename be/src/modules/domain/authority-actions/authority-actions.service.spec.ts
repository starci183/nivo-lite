import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { AuthorityActionRecord } from "./authority-actions.contracts"
import { AuthorityActionsService } from "./authority-actions.service"
import { AuthorityActionEntity } from "./persistence/entities"

const RECORD: AuthorityActionRecord = {
    action: "issue_invoice",
    module_key: "accounting",
    sort_order: 0,
    default_mode: "auto",
    default_limit_vnd: 20000000,
    default_required_fields: ["customer"],
    amount_limit: true,
    max_mode: null,
    label: { vi: "vi", en: "Issue invoice" },
}

const ROW = Object.assign(new AuthorityActionEntity(), {
    action: "issue_invoice",
    moduleKey: "accounting",
    sortOrder: 0,
    defaultMode: "auto",
    defaultLimitVnd: "20000000",
    defaultRequiredFields: ["customer"],
    amountLimit: true,
    maxMode: null,
    label: { vi: "vi", en: "Issue invoice" },
})

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [AuthorityActionsService] }).compile()
    return moduleRef.get(AuthorityActionsService)
}

describe("AuthorityActionsService", () => {
    describe("upsertAll", () => {
        it("upserts the records in one statement in the given transaction and reports nothing stale", async () => {
            const em = mockEntityManager({
                find: [AuthorityActionEntity, [ROW]],
                upsert: [AuthorityActionEntity, { identifiers: [{ action: "issue_invoice" }], generatedMaps: [] }],
            })

            await expect((await build()).upsertAll(em, [RECORD])).resolves.toEqual({ written: 1, stale: [] })
            expect(em.upsert).toHaveBeenCalledWith(
                AuthorityActionEntity,
                [
                    expect.objectContaining({
                        action: "issue_invoice",
                        moduleKey: "accounting",
                        sortOrder: 0,
                        defaultMode: "auto",
                        defaultLimitVnd: "20000000",
                        defaultRequiredFields: ["customer"],
                        amountLimit: true,
                        maxMode: null,
                        label: { vi: "vi", en: "Issue invoice" },
                    }),
                ],
                ["action"],
            )
        })

        it("reports the actions the database holds that were not written, and deletes nothing", async () => {
            const em = mockEntityManager({
                find: [
                    AuthorityActionEntity,
                    [ROW, Object.assign(new AuthorityActionEntity(), { action: "retired_action" })],
                ],
                upsert: [AuthorityActionEntity, { identifiers: [{ action: "issue_invoice" }], generatedMaps: [] }],
            })

            await expect((await build()).upsertAll(em, [RECORD])).resolves.toEqual({
                written: 1,
                stale: ["retired_action"],
            })
        })
    })
})

describe("AuthorityActionsService nullable limits and empty syncs", () => {
    it("writes nothing for an empty catalogue and reports every held action stale", async () => {
        const em = mockEntityManager({ find: [AuthorityActionEntity, [ROW]] })

        await expect((await build()).upsertAll(em, [])).resolves.toEqual({ written: 0, stale: ["issue_invoice"] })
        expect(em.upsert).not.toHaveBeenCalled()
    })

    it("stores a record without a default limit as null and reads a null limit back as null", async () => {
        const open: AuthorityActionRecord = { ...RECORD, default_limit_vnd: null }
        const em = mockEntityManager({
            find: [AuthorityActionEntity, [Object.assign(new AuthorityActionEntity(), ROW, { defaultLimitVnd: null })]],
            upsert: [AuthorityActionEntity, { identifiers: [{ action: "issue_invoice" }], generatedMaps: [] }],
        })
        const service = await build()

        await service.upsertAll(em, [open])
        expect(em.upsert).toHaveBeenCalledWith(
            AuthorityActionEntity,
            [expect.objectContaining({ defaultLimitVnd: null })],
            ["action"],
        )
        await expect(service.list(em)).resolves.toEqual([open])
    })
})

describe("AuthorityActionsService reads", () => {
    describe("registeredUnder", () => {
        it("reads the pair under a shared lock and answers whether the catalogue holds it", async () => {
            const em = mockEntityManager()
            const fake = fakeQueryBuilder({ getOne: { action: "issue_invoice" } })
            em.createQueryBuilder.mockReturnValue(fake.builder)

            await expect((await build()).registeredUnder(em, "issue_invoice", "accounting")).resolves.toBe(true)
            expect(fake.callsOf("where")).toEqual([
                [
                    "a.action = :action AND a.moduleKey = :department",
                    { action: "issue_invoice", department: "accounting" },
                ],
            ])
            expect(fake.callsOf("setLock")).toEqual([["pessimistic_read"]])
        })

        it("answers false when the catalogue does not hold the pair", async () => {
            const em = mockEntityManager()
            em.createQueryBuilder.mockReturnValue(fakeQueryBuilder({ getOne: null }).builder)

            await expect((await build()).registeredUnder(em, "issue_invoice", "sales")).resolves.toBe(false)
        })
    })

    describe("exists", () => {
        it("asks the given manager whether the catalogue holds the action", async () => {
            const em = mockEntityManager({ exists: [AuthorityActionEntity, true] })

            await expect((await build()).exists(em, "issue_invoice")).resolves.toBe(true)
            expect(em.exists).toHaveBeenCalledWith(AuthorityActionEntity, { where: { action: "issue_invoice" } })
        })
    })

    describe("list", () => {
        it("reads every catalogue action through the given manager", async () => {
            const em = mockEntityManager({ find: [AuthorityActionEntity, [ROW]] })

            await expect((await build()).list(em)).resolves.toEqual([RECORD])
        })
    })
})
