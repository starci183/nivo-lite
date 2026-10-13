import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { AuthorityActionRecord } from "./authority-actions.contracts"
import { AuthorityActionsService } from "./authority-actions.service"
import { LIST_ACTION_KEYS, LIST_AUTHORITY_ACTIONS, UPSERT_AUTHORITY_ACTIONS } from "./persistence/authority-actions.sql"

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

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [AuthorityActionsService] }).compile()
    return moduleRef.get(AuthorityActionsService)
}

describe("AuthorityActionsService", () => {
    describe("upsertAll", () => {
        it("upserts the records as one JSON array in the given transaction and reports nothing stale", async () => {
            const em = mockEntityManager({
                query: [
                    [UPSERT_AUTHORITY_ACTIONS, [{ action: "issue_invoice" }]],
                    [LIST_ACTION_KEYS, [{ action: "issue_invoice" }]],
                ],
            })

            await expect((await build()).upsertAll(em, [RECORD])).resolves.toEqual({ written: 1, stale: [] })
            expect(em.query).toHaveBeenCalledWith(UPSERT_AUTHORITY_ACTIONS, [JSON.stringify([RECORD])])
        })

        it("reports the actions the database holds that were not written, and deletes nothing", async () => {
            const em = mockEntityManager({
                query: [
                    [UPSERT_AUTHORITY_ACTIONS, [{ action: "issue_invoice" }]],
                    [LIST_ACTION_KEYS, [{ action: "issue_invoice" }, { action: "retired_action" }]],
                ],
            })

            await expect((await build()).upsertAll(em, [RECORD])).resolves.toEqual({
                written: 1,
                stale: ["retired_action"],
            })
        })
    })
    describe("list", () => {
        it("reads every catalogue action through the given manager", async () => {
            const em = mockEntityManager({ query: [[LIST_AUTHORITY_ACTIONS, [RECORD]]] })

            await expect((await build()).list(em)).resolves.toEqual([RECORD])
        })
    })
})
