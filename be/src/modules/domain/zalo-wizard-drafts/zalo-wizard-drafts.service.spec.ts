import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ZaloWizardDraftEntity } from "./persistence/entities"
import { ZaloWizardDraftsService } from "./zalo-wizard-drafts.service"

const draftOf = (keys: Pick<ZaloWizardDraftEntity, "appId" | "appSecret" | "oaSecret">): ZaloWizardDraftEntity =>
    Object.assign(new ZaloWizardDraftEntity(), { connectionId: "c-1" }, keys)

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
        const { service, em } = await build(draftOf({ appId: "app-1", appSecret: "app-secret", oaSecret: "oa-secret" }))

        await expect(service.draftOf("c-1")).resolves.toEqual({
            present: true,
            appId: "app-1",
            appSecret: "app-secret",
            oaSecret: "oa-secret",
        })
        expect(em.findOneBy).toHaveBeenCalledWith(ZaloWizardDraftEntity, { connectionId: "c-1" })
    })

    it("answers empty keys for the null columns of a present draft", async () => {
        const { service, em } = await build(draftOf({ appId: null, appSecret: null, oaSecret: null }))

        await expect(service.draftOf("c-1")).resolves.toEqual({ present: true, appId: "", appSecret: "", oaSecret: "" })
        expect(em.findOneBy).toHaveBeenCalledWith(ZaloWizardDraftEntity, { connectionId: "c-1" })
    })

    it("answers an absent draft when the connection has none", async () => {
        const { service, em } = await build()

        await expect(service.draftOf("c-1")).resolves.toEqual({
            present: false,
            appId: "",
            appSecret: "",
            oaSecret: "",
        })
        expect(em.findOneBy).toHaveBeenCalledWith(ZaloWizardDraftEntity, { connectionId: "c-1" })
    })

    it("drops the draft of the connection after its keys are sealed", async () => {
        const { service, em } = await build()

        await expect(service.dropDraft("c-1")).resolves.toBeUndefined()

        expect(em.delete).toHaveBeenCalledWith(ZaloWizardDraftEntity, { connectionId: "c-1" })
    })
})
