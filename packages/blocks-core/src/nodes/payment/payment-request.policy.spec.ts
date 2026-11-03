import {
    itemsTextOf,
    noAccountTitleOf,
    paymentMessageOf,
    transferContentOf,
} from "./payment-request.policy"

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
        expect(itemsTextOf([{ name: "tea", qty: 2 }, { name: "cake", qty: 1 }])).toBe("2 x tea, 1 x cake")
    })

    it("writes the amount, the content, the holder and the link in the language asked", () => {
        const order = { amountVnd: 1_500_000, lines: [{ name: "tea", qty: 1 }] }

        const vi = paymentMessageOf(instruction, order, "DH1", "vi")
        const en = paymentMessageOf({ ...instruction, bankName: "MB Bank" }, order, "DH1", "en")

        expect(vi).toContain("1 x tea · 1.500.000 đ")
        expect(vi).toContain("Ngân hàng: MBBank")
        expect(vi).toContain("Chủ tài khoản: NGUYEN VAN A")
        expect(vi).toContain("Hoặc quét mã QR: https://qr.example/x")
        expect(en).toContain("1 x tea · 1,500,000 VND")
        expect(en).toContain("Bank: MB Bank")
        expect(en).toContain("Transfer content (type exactly): DH1")
        expect(paymentMessageOf({ ...instruction, accountHolder: "" }, order, "DH1", "en")).not.toContain("holder")
    })

    it("names the order in the title that tells the owner no payment request could go out", () => {
        expect(noAccountTitleOf("DH-1", "en")).toContain("DH-1")
        expect(noAccountTitleOf("DH-1", "vi")).toContain("SePay")
    })
})
