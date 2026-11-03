import {
    isPayableAccount,
    itemsTextOf,
    noAccountTitleOf,
    paymentMessageOf,
    transferContentOf,
} from "./payment-request.policy"

const account = {
    provider: "sepay",
    bankCode: "MBBank",
    bankName: null,
    accountNumber: "525209999",
    accountHolder: "NGUYEN VAN A",
}

describe("payment request policy", () => {
    it("keeps letters and digits of the order number, upper case", () => {
        expect(transferContentOf("DH-20261105-0001")).toBe("DH202611050001")
        expect(transferContentOf("so 2026/11_x")).toBe("SO202611X")
    })

    it("accepts only a SePay account", () => {
        expect(isPayableAccount(account)).toBe(true)
        expect(isPayableAccount({ ...account, provider: "casso" })).toBe(false)
        expect(isPayableAccount(undefined)).toBe(false)
    })

    it("lists the items in a few words", () => {
        expect(itemsTextOf([{ name: "tea", qty: 2 }, { name: "cake", qty: 1 }])).toBe("2 x tea, 1 x cake")
    })

    it("writes the amount, the content, the holder and the link in the language asked", () => {
        const order = { amountVnd: 1_500_000, lines: [{ name: "tea", qty: 1 }] }
        const pay = { content: "DH1", qrUrl: "https://qr.example/x" }

        const vi = paymentMessageOf(account, order, pay, "vi")
        const en = paymentMessageOf({ ...account, bankName: "MB Bank" }, order, pay, "en")

        expect(vi).toContain("1 x tea · 1.500.000 đ")
        expect(vi).toContain("Ngân hàng: MBBank")
        expect(vi).toContain("Chủ tài khoản: NGUYEN VAN A")
        expect(vi).toContain("Hoặc quét mã QR: https://qr.example/x")
        expect(en).toContain("1 x tea · 1,500,000 VND")
        expect(en).toContain("Bank: MB Bank")
        expect(en).toContain("Transfer content (type exactly): DH1")
    })

    it("names the order in the title that tells the owner no payment request could go out", () => {
        expect(noAccountTitleOf("DH-1", "en")).toContain("DH-1")
        expect(noAccountTitleOf("DH-1", "vi")).toContain("SePay")
    })
})
