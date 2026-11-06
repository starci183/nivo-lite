import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { WorkContext } from "@modules/domain/decisions"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { PerformerKitService } from "./performer-kit.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }
const english: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const build = async () => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params, locale) => `${locale}:${key}:${JSON.stringify(params)}`)
    const moduleRef = await Test.createTestingModule({
        providers: [PerformerKitService, { provide: MESSAGE_CATALOG, useValue: catalog }],
    }).compile()
    return { kit: moduleRef.get(PerformerKitService), catalog }
}

describe("PerformerKitService", () => {
    it("reads a performer text in the language of the call", async () => {
        const { kit, catalog } = await build()

        expect(kit.text(ctx, "hello", { name: "Lan" })).toBe('vi:performers.hello:{"name":"Lan"}')
        expect(catalog.get).toHaveBeenCalledWith("performers.hello", { name: "Lan" }, "vi")
    })

    it("reads a performer text with no parameters", async () => {
        const { kit } = await build()

        expect(kit.text(english, "hello")).toBe("en:performers.hello:{}")
    })
})
