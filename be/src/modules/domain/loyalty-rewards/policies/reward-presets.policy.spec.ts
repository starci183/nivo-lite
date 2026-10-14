import { mock } from "@starci/jest-preset"
import type { MessageCatalog } from "@modules/platform/i18n"
import { rewardPresetEdits } from "./reward-presets.policy"

describe("rewardPresetEdits", () => {
    it("resolves every starter reward name and note in the stored Vietnamese locale", () => {
        const messages = mock<MessageCatalog>()
        messages.get
            .mockReturnValueOnce("Phi\u1ebfu 50k")
            .mockReturnValueOnce("Ghi ch\u00fa phi\u1ebfu")
            .mockReturnValueOnce("Gi\u1ea3m 10%")
            .mockReturnValueOnce("Ghi ch\u00fa gi\u1ea3m")
            .mockReturnValueOnce("Qu\u00e0 t\u1eb7ng")
            .mockReturnValueOnce("Ghi ch\u00fa qu\u00e0")

        expect(rewardPresetEdits(messages)).toEqual([
            {
                key: "voucher-50k",
                kind: "voucher",
                valueVnd: 50000,
                percent: null,
                pointsCost: 500,
                stock: null,
                perCustomerLimit: null,
                minTierKey: null,
                active: true,
                name: "Phi\u1ebfu 50k",
                note: "Ghi ch\u00fa phi\u1ebfu",
            },
            {
                key: "giam-10",
                kind: "percent",
                valueVnd: 100000,
                percent: 10,
                pointsCost: 800,
                stock: null,
                perCustomerLimit: 2,
                minTierKey: null,
                active: true,
                name: "Gi\u1ea3m 10%",
                note: "Ghi ch\u00fa gi\u1ea3m",
            },
            {
                key: "qua-tang",
                kind: "item",
                valueVnd: 150000,
                percent: null,
                pointsCost: 1200,
                stock: 20,
                perCustomerLimit: 1,
                minTierKey: "bac",
                active: true,
                name: "Qu\u00e0 t\u1eb7ng",
                note: "Ghi ch\u00fa qu\u00e0",
            },
        ])
        expect(messages.get.mock.calls).toEqual([
            ["loyalty.rewardPreset.voucher50k.name", {}, "vi"],
            ["loyalty.rewardPreset.voucher50k.note", {}, "vi"],
            ["loyalty.rewardPreset.percent10.name", {}, "vi"],
            ["loyalty.rewardPreset.percent10.note", {}, "vi"],
            ["loyalty.rewardPreset.shopGift.name", {}, "vi"],
            ["loyalty.rewardPreset.shopGift.note", {}, "vi"],
        ])
    })
})
