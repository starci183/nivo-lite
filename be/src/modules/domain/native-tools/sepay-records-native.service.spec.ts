import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ToolsErrorCode, SEPAY_MANIFEST, SepayNativeService, toolNameOf } from "@modules/domain/tools"
import { nativeRefusal } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"
import { SepayRecordsNativeService } from "./sepay-records-native.service"

const WS = "11111111-1111-4111-8111-111111111111"
const CALLER = { agentId: "a1", conversationId: null }

const build = async () => {
    const sepay = mock<SepayNativeService>()
    sepay.invoke.mockResolvedValue({ transactions: [] })
    const views = mock<NativeViewService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SepayRecordsNativeService,
            { provide: NativeViewService, useValue: views },
            { provide: SepayNativeService, useValue: sepay },
        ],
    }).compile()
    return { records: moduleRef.get(SepayRecordsNativeService), sepay, views }
}

describe("SepayRecordsNativeService manifest", () => {
    it("is the sepay connector, its two tools published as the payment purposes and no status beside them", async () => {
        const { records } = await build()

        expect(records.manifest).toBe(SEPAY_MANIFEST)
        expect(records.manifest.key).toBe("sepay")
        expect(records.manifest.tools.map((tool) => toolNameOf(records.manifest, tool.name))).toEqual([
            "nivo.tool.payment.credit.list",
            "nivo.tool.payment.debit.list",
        ])
    })
})

describe("SepayRecordsNativeService", () => {
    it("runs the bank tools through the gateway's own adapter once the caller's view is judged", async () => {
        const { records, sepay, views } = await build()

        await expect(records.invoke(WS, "credit.list", { limit: 5 }, CALLER)).resolves.toEqual({ transactions: [] })

        expect(views.internalOf).toHaveBeenCalledWith(WS, CALLER)
        expect(sepay.invoke).toHaveBeenCalledWith(WS, "credit.list", { limit: 5 })
    })

    it("lets the bank adapter refuse a tool it does not have", async () => {
        const { records, sepay } = await build()
        sepay.invoke.mockRejectedValue({ code: ToolsErrorCode.UnknownTool })

        await expect(records.invoke(WS, "status.get", {}, CALLER)).rejects.toMatchObject({
            code: ToolsErrorCode.UnknownTool,
        })
    })

    it.each(["credit.list", "debit.list"])(
        "refuses %s to a caller the view policy keeps out, before any bank read",
        async (tool) => {
            const { records, sepay, views } = await build()
            views.internalOf.mockRejectedValue(nativeRefusal("internal_only"))

            await expect(records.invoke(WS, tool, {}, { agentId: "a1", conversationId: "c1" })).rejects.toMatchObject({
                code: ToolsErrorCode.NativeRefused,
                params: { reason: "internal_only" },
            })
            expect(sepay.invoke).not.toHaveBeenCalled()
        },
    )
})
