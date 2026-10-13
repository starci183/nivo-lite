import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AuthorityService } from "@modules/domain/authority"
import type { Authority } from "@modules/domain/authority"
import { formatVnd, ModuleCatalogService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import type { LeadRecordRow } from "@modules/domain/leads"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { PerformerKitService } from "./performer-kit.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }
const english: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const authority: Authority = {
    policies: " No refunds ",
    reply_style: "warm",
    brand_voice: "",
    limits_note: " discounts ",
}

const lead: LeadRecordRow = {
    id: "lead-1",
    workspace_id: "ws-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "zalo",
    need: "wholesale",
    stage: "new",
    context_summary: null,
    phone: null,
    email: null,
    origin: "live",
}

describe("PerformerKitService", () => {
    const build = async () => {
        const catalog = mock<MessageCatalog>()
        catalog.get.mockImplementation((key, params, locale) => `${locale}:${key}:${JSON.stringify(params)}`)
        const authorityService = mock<AuthorityService>()
        const modules = mock<ModuleCatalogService>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                PerformerKitService,
                { provide: MESSAGE_CATALOG, useValue: catalog },
                { provide: AuthorityService, useValue: authorityService },
                { provide: ModuleCatalogService, useValue: modules },
            ],
        }).compile()
        return { kit: moduleRef.get(PerformerKitService), catalog, authorityService, modules }
    }

    it("reads a performer text in the language of the call", async () => {
        const { kit, catalog } = await build()

        expect(kit.text(ctx, "hello", { name: "Lan" })).toBe('vi:performers.hello:{"name":"Lan"}')
        expect(catalog.get).toHaveBeenCalledWith("performers.hello", { name: "Lan" }, "vi")
    })

    it("reads a performer text with no parameters", async () => {
        const { kit } = await build()

        expect(kit.text(english, "hello")).toBe("en:performers.hello:{}")
    })

    it("formats an amount in dong", async () => {
        const { kit } = await build()

        expect(kit.money(ctx, 1500000)).toBe(formatVnd(1500000, "vi"))
        expect(kit.money(english, 1500000)).toBe(formatVnd(1500000, "en"))
    })

    it("says there is no amount yet when the amount is missing", async () => {
        const { kit } = await build()

        expect(kit.money(ctx, null)).toBe("vi:performers.orderNoAmount:{}")
        expect(kit.money(english, undefined)).toBe("en:performers.orderNoAmount:{}")
    })

    it("writes the owner's authority as a prompt section", async () => {
        const { kit, authorityService } = await build()
        authorityService.load.mockResolvedValue(authority)

        await expect(kit.brief(ctx)).resolves.toBe(
            "\nAuthority granted by the owner:\nBusiness policies:\nNo refunds\nReply style: warm\nAlways ask the owner first when: discounts",
        )
        expect(authorityService.load).toHaveBeenCalledWith({ workspaceId: "ws-1" })
    })

    it("writes an empty brief when the workspace has no authority", async () => {
        const { kit, authorityService } = await build()
        authorityService.load.mockResolvedValue(null)

        await expect(kit.brief(ctx)).resolves.toBe("")
    })

    it("names the workspace and language a prompt writes for", async () => {
        const { kit } = await build()

        expect(kit.scope(english)).toEqual({ workspaceId: "ws-1", locale: "en" })
    })

    it("reads a lead the way a prompt does", async () => {
        const { kit } = await build()

        expect(kit.leadInput(lead)).toEqual({
            contact_name: "Lan",
            company: "Hue Tea",
            channel: "zalo",
            need: "wholesale",
        })
    })

    it("names a department in the language of the call", async () => {
        const { kit, modules } = await build()
        modules.nameOf.mockResolvedValue("Sales")

        await expect(kit.department(ctx, "sales")).resolves.toBe("Sales")
        expect(modules.nameOf).toHaveBeenCalledWith("sales", "vi")
    })

    it("labels a lead stage", async () => {
        const { kit, catalog } = await build()

        expect(kit.stage(ctx, "won")).toBe("vi:performers.stage.won:{}")
        expect(catalog.get).toHaveBeenCalledWith("performers.stage.won", {}, "vi")
    })
})
