import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { WizardDraftRow } from "./persistence/zalo-wizard-drafts.rows"
import { DROP_WIZARD_DRAFT, FIND_WIZARD_DRAFT } from "./persistence/zalo-wizard-drafts.sql"
import { ZaloWizardDraftsService } from "./zalo-wizard-drafts.service"

const build = async (found: ReadonlyArray<WizardDraftRow> = []) => {
    const em = mockEntityManager({
        query: [
            [FIND_WIZARD_DRAFT, found],
            [DROP_WIZARD_DRAFT, []],
        ],
    })
    const moduleRef = await Test.createTestingModule({
        providers: [ZaloWizardDraftsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(ZaloWizardDraftsService), em }
}

describe("ZaloWizardDraftsService", () => {
    it("reads the app and OA keys waiting for the connection", async () => {
        const { service, em } = await build([{ app_id: "app-1", app_secret: "app-secret", oa_secret: "oa-secret" }])

        await expect(service.draftOf("c-1")).resolves.toEqual({
            present: true,
            appId: "app-1",
            appSecret: "app-secret",
            oaSecret: "oa-secret",
        })
        expect(em.query.mock.calls).toEqual([[FIND_WIZARD_DRAFT, ["c-1"]]])
    })

    it("answers empty keys for the null columns of a present draft", async () => {
        const { service, em } = await build([{ app_id: null, app_secret: null, oa_secret: null }])

        await expect(service.draftOf("c-1")).resolves.toEqual({ present: true, appId: "", appSecret: "", oaSecret: "" })
        expect(em.query.mock.calls).toEqual([[FIND_WIZARD_DRAFT, ["c-1"]]])
    })

    it("answers an absent draft when the connection has none", async () => {
        const { service, em } = await build()

        await expect(service.draftOf("c-1")).resolves.toEqual({ present: false, appId: "", appSecret: "", oaSecret: "" })
        expect(em.query.mock.calls).toEqual([[FIND_WIZARD_DRAFT, ["c-1"]]])
    })

    it("drops the draft of the connection after its keys are sealed", async () => {
        const { service, em } = await build()

        await expect(service.dropDraft("c-1")).resolves.toBeUndefined()

        expect(em.query.mock.calls).toEqual([[DROP_WIZARD_DRAFT, ["c-1"]]])
    })
})
