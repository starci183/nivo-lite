import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ZaloWizardDraftEntity } from "./persistence/entities"
import { ZaloWizardDraftsService } from "./zalo-wizard-drafts.service"

/** The criteria that name the draft of connection `c-1`. */
const CONNECTION = { connectionId: "c-1" }

const draftOf = (appId: string | null, appSecret: string | null, oaSecret: string | null): ZaloWizardDraftEntity =>
    Object.assign(new ZaloWizardDraftEntity(), CONNECTION, { appId, appSecret, oaSecret })

const build = async (found: ZaloWizardDraftEntity | null = null) => {
    const em = mockEntityManager({
        findOneBy: [ZaloWizardDraftEntity, found],
        delete: [ZaloWizardDraftEntity, { affected: 1, raw: [] }],
    })
    const moduleRef = await Test.createTestingModule({
        providers: [ZaloWizardDraftsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(ZaloWizardDraftsService), em }
}

describe("ZaloWizardDraftsService", () => {
    it("reads the app and OA keys waiting for the connection", async () => {
        const { service, em } = await build(draftOf("app-1", "app-secret", "oa-secret"))

        await expect(service.draftOf("c-1")).resolves.toEqual({
            present: true,
            appId: "app-1",
            appSecret: "app-secret",
            oaSecret: "oa-secret",
        })
        expect(em.findOneBy).toHaveBeenCalledWith(ZaloWizardDraftEntity, CONNECTION)
    })

    it("answers empty keys for the null columns of a present draft", async () => {
        const { service, em } = await build(draftOf(null, null, null))

        await expect(service.draftOf("c-1")).resolves.toEqual({ present: true, appId: "", appSecret: "", oaSecret: "" })
        expect(em.findOneBy).toHaveBeenCalledWith(ZaloWizardDraftEntity, CONNECTION)
    })

    it("answers an absent draft when the connection has none", async () => {
        const { service, em } = await build()

        await expect(service.draftOf("c-1")).resolves.toEqual({
            present: false,
            appId: "",
            appSecret: "",
            oaSecret: "",
        })
        expect(em.findOneBy).toHaveBeenCalledWith(ZaloWizardDraftEntity, CONNECTION)
    })

    it("drops the draft of the connection after its keys are sealed", async () => {
        const { service, em } = await build()

        await expect(service.dropDraft("c-1")).resolves.toBeUndefined()

        expect(em.delete).toHaveBeenCalledWith(ZaloWizardDraftEntity, CONNECTION)
    })
})
