import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OfficeLog, ModuleTextGenerator } from "@modules/domain/module-ops"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { AuthorityService } from "@modules/domain/authority"
import type { AuthorityProfile } from "@modules/domain/authority"
import type { LoadedPo } from "./inventory.contracts"
import { InventoryOrderMessageService } from "./inventory-order-message.service"

const textLike = (text: string): unknown => expect.stringContaining(text)

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const poOf = (overrides: Partial<LoadedPo> = {}): LoadedPo => ({
    id: "po-1",
    poNo: "PO-202610-0001",
    supplierId: "sup-1",
    status: "draft",
    totalVnd: 60000,
    expectedAt: "2026-10-14",
    message: "",
    reminders: 0,
    supplier: { name: "Mill Co", contactName: "Huong", email: null, channel: "zalo", leadTimeDays: 2 },
    lines: [
        {
            id: "line-1",
            itemId: "item-1",
            qtyOrdered: 10,
            qtyReceived: 4,
            unitCost: 6000,
            itemName: "Tea",
            itemUnit: "kg",
        },
        {
            id: "line-2",
            itemId: "item-2",
            qtyOrdered: 5,
            qtyReceived: 5,
            unitCost: 100,
            itemName: null,
            itemUnit: null,
        },
    ],
    ...overrides,
})

/** The voice the owner set on the authority sheet. */
interface Voice {
    readonly brand_voice: string
    readonly reply_style: string
}

/** The authority sheet that carries this voice and nothing else. */
const profileOf = (voice: Voice): AuthorityProfile => ({
    policies: "",
    limits_note: "",
    goal_revenue_vnd: null,
    goal_new_customers: null,
    goal_first_reply_minutes: null,
    goal_note: "",
    updated_by: null,
    updated_at: "2026-10-01T00:00:00.000Z",
    ...voice,
})

const build = async (voice: Voice | null) => {
    const authority = mock<AuthorityService>()
    authority.profileOf.mockResolvedValue(voice === null ? null : profileOf(voice))
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const office = mock<OfficeLog>()
    office.workspaceName.mockResolvedValue("Quan Cafe")
    const generator = mock<ModuleTextGenerator>()
    generator.generate.mockResolvedValue({ ok: false, output: "" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryOrderMessageService,
            { provide: AuthorityService, useValue: authority },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: OfficeLog, useValue: office },
            { provide: ModuleTextGenerator, useValue: generator },
        ],
    }).compile()
    return { service: moduleRef.get(InventoryOrderMessageService), generator, authority }
}

describe("InventoryOrderMessageService.compose", () => {
    it("uses the text the generator wrote, trimmed and cut, and hands it the facts of the order", async () => {
        const { service, generator, authority } = await build({ brand_voice: "warm", reply_style: "short" })
        generator.generate.mockResolvedValue({ ok: true, output: `  ${"x".repeat(2000)}  ` })

        const message = await service.compose("ws-1", poOf(), "order")

        expect(message).toEqual({ text: "x".repeat(1800), generated: true })
        expect(authority.profileOf).toHaveBeenCalledWith("ws-1")
        expect(generator.generate).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            purpose: "inventory_po_message",
            module: "inventory",
            system: text("inventory.ai.system"),
            user: textLike(text("inventory.ai.factVoice", { voice: "warm short" })),
            timeoutMs: 40000,
        })
        const user = generator.generate.mock.calls[0]?.[0].user ?? ""
        expect(user).toContain(text("inventory.ai.taskOrder"))
        expect(user).toContain(text("inventory.ai.factTotal", { total: "60.000 ₫" }))
        expect(user).toContain(text("inventory.ai.factDue", { date: "14/10/2026" }))
        expect(user).toContain("inventory.ai.factChannel")
        expect(user).toContain("inventory.ai.factContact")
    })

    it("falls back to the order template when the generator wrote nothing or too little", async () => {
        const { service, generator } = await build(null)
        generator.generate.mockResolvedValueOnce({ ok: true, output: "short" })

        const tooShort = await service.compose("ws-1", poOf(), "order")
        const nothing = await service.compose("ws-1", poOf(), "order")

        const template = text("inventory.orderMessage", {
            who: "Huong",
            shop: "Quan Cafe",
            list: `- Tea: ${"10"} kg\n- ${text("inventory.itemFallback")}: 5 `,
            expected: text("inventory.orderExpected", { date: "14/10/2026" }),
        })
        expect(tooShort).toEqual({ text: template, generated: false })
        expect(nothing).toEqual({ text: template, generated: false })
    })

    it("writes a reminder for what is still missing, without the total or a due day when there is none", async () => {
        const { service, generator } = await build(null)

        const message = await service.compose("ws-1", poOf({ expectedAt: null }), "reminder")

        expect(message).toEqual({
            text: text("inventory.reminderMessage", {
                who: "Huong",
                shop: "Quan Cafe",
                poNo: "PO-202610-0001",
                due: "",
                list: "- Tea: 6 kg",
            }),
            generated: false,
        })
        const request = generator.generate.mock.calls[0]?.[0]
        expect(request?.purpose).toBe("inventory_po_reminder")
        expect(request?.user).toContain(text("inventory.ai.taskReminder"))
        expect(request?.user).not.toContain("inventory.ai.factTotal")
        expect(request?.user).not.toContain("inventory.ai.factDue")
    })
})

describe("InventoryOrderMessageService.compose", () => {
    it("writes a reminder with the due day", async () => {
        const { service } = await build(null)

        const message = await service.compose("ws-1", poOf(), "reminder")

        expect(message.text).toContain("inventory.reminderDue")
    })

    it("uses the supplier name or a polite fallback and defaults to email", async () => {
        const { service, generator } = await build(null)

        const byName = await service.compose(
            "ws-1",
            poOf({ supplier: { name: "Mill Co", contactName: "", email: null, channel: "email", leadTimeDays: 2 } }),
            "order",
        )
        const nobody = await service.compose("ws-1", poOf({ supplier: null, expectedAt: null }), "order")

        expect(byName.text).toContain('"who":"Mill Co"')
        expect(nobody.text).toContain(`"who":"${text("inventory.addressFallback")}"`)
        expect(generator.generate.mock.calls[1]?.[0].user).toContain(text("inventory.channelFact.email"))
    })
})
