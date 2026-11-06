import {
    itemsTextOf,
    noAccountTitleOf,
    orderLinesOf,
    notPayableTitleOf,
    orderHeldMessageOf,
    paymentMessageOf,
    transferContentOf,
} from "./payment-request.policy"
import { sampleOf } from "../../messages/catalog"

const instruction = {
    provider: "sepay",
    bankCode: "MBBank",
    bankName: "",
    accountNumber: "525209999",
    accountHolder: "NGUYEN VAN A",
    qrUrl: "https://qr.example/x",
}

describe("payment request policy", () => {
    it("keeps letters and digits of the order number, upper case", () => {
        expect(transferContentOf("DH-20261105-0001")).toBe("DH202611050001")
        expect(transferContentOf("so 2026/11_x")).toBe("SO202611X")
    })

    it("lists the items in a few words", () => {
        expect(
            itemsTextOf([
                { name: "tea", qty: 2 },
                { name: "cake", qty: 1 },
            ]),
        ).toBe("2 x tea, 1 x cake")
    })

    it("writes the amount, the content, the holder and the link in the language asked", () => {
        const order = { amountVnd: 1_500_000, lines: [{ name: "tea", qty: 1 }] }

        const vi = paymentMessageOf(instruction, order, "DH1", "vi")
        const en = paymentMessageOf({ ...instruction, bankName: "MB Bank" }, order, "DH1", "en")

        expect(vi).toContain(sampleOf("sample1XTea1500000"))
        expect(vi).toContain(sampleOf("sampleNganHangMbbank"))
        expect(vi).toContain(sampleOf("sampleChuTaiKhoanNguyenVanA"))
        expect(vi).toContain(sampleOf("sampleHoacQuetMaQrHttpsQr"))
        expect(en).toContain("1 x tea · 1,500,000 VND")
        expect(en).toContain("Bank: MB Bank")
        expect(en).toContain("Transfer content (type exactly): DH1")
        expect(paymentMessageOf({ ...instruction, accountHolder: "" }, order, "DH1", "en")).not.toContain("holder")
    })

    it("names the order in the title that tells the owner no payment request could go out", () => {
        expect(noAccountTitleOf("DH-1", "en")).toContain("DH-1")
        expect(noAccountTitleOf("DH-1", "vi")).toContain("SePay")
    })

    it("tells the customer the order is recorded and the payment details follow, with the items and the amount", () => {
        const order = { amountVnd: 300_000, lines: [{ name: "tea", qty: 2 }] }

        expect(orderHeldMessageOf(order, "en")).toBe(
            "We have recorded your order: 2 x tea · 300,000 VND. The shop will send you the payment details as soon as they are ready.",
        )
        expect(orderHeldMessageOf({ amountVnd: 300_000, lines: [] }, "vi")).toContain("— · ")
    })

    it("titles the owner item of an order that cannot be paid yet in the language asked", () => {
        expect(notPayableTitleOf("o1", "en")).toBe("Order o1 cannot be paid yet: it is not confirmed or has no amount")
        expect(notPayableTitleOf("o1", "vi")).toContain("o1")
    })

    it("reads the lines from the object a sales record keeps them in, and finds none in any other shape instead of failing", () => {
        const record = { lines: [{ name: "tea", qty: 2, unitVnd: 150_000, amountVnd: 300_000 }] }

        expect(orderLinesOf(record)).toEqual([{ name: "tea", qty: 2 }])
        expect(orderLinesOf({ lines: [] })).toEqual([])
        for (const other of [[{ name: "tea", qty: 2 }], "2 x tea", null, undefined, {}, { lines: "tea" }]) {
            expect(orderLinesOf(other)).toEqual([])
        }
    })
})
