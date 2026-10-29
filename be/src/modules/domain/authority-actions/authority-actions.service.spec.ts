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

/** A manager whose catalogue read answers `held` and whose upsert statement answers `raw`. */
const syncing = (held: ReadonlyArray<AuthorityActionEntity>, raw: ReadonlyArray<unknown>) => {
    const em = mockEntityManager({ find: [AuthorityActionEntity, held] })
    const fake = fakeQueryBuilder({ execute: { raw } })
    em.createQueryBuilder.mockReturnValue(fake.builder)
    return { em, fake }
}

describe("AuthorityActionsService", () => {
    describe("upsertAll", () => {
        it("upserts the records in one statement in the given transaction and reports nothing stale", async () => {
            const { em, fake } = syncing([ROW], [{ action: "issue_invoice" }])

            await expect((await build()).upsertAll(em, [RECORD])).resolves.toEqual({ written: 1, stale: [] })
            expect(em.createQueryBuilder).toHaveBeenCalledWith(AuthorityActionEntity, "aa")
            expect(fake.callsOf("values")).toEqual([
                [
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
                ],
            ])
            expect(fake.callsOf("orUpdate")).toEqual([[expect.arrayContaining(["module_key", "label"]), ["action"]]])
            expect(fake.callsOf("returning")).toEqual([["action"]])
        })

        it("reports the actions the database holds that were not written, and deletes nothing", async () => {
            const { em } = syncing(
                [ROW, Object.assign(new AuthorityActionEntity(), { action: "retired_action" })],
                [{ action: "issue_invoice" }],
            )

            await expect((await build()).upsertAll(em, [RECORD])).resolves.toEqual({
                written: 1,
                stale: ["retired_action"],
            })
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
