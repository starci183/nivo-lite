import { accountLabelOf } from "./account-label.policy"

describe("accountLabelOf", () => {
    it("names a bank feed by its bank and masked number", () => {
        expect(accountLabelOf("sepay", "SePay", { bank_code: "MBBANK", account_masked: "•••• 9999" })).toBe("MB Bank •••• 9999")
        expect(accountLabelOf("sepay", "SePay", { bank_code: "timo", account_masked: "•••• 1010" })).toBe("Timo •••• 1010")
        expect(accountLabelOf("sepay", "SePay", { account_masked: "•••• 9999" })).toBe("•••• 9999")
        expect(accountLabelOf("sepay", "SePay", {})).toBe("SePay")
    })

    it("names a Google account by the sheet it keeps, with the email, else by the email", () => {
        expect(accountLabelOf("google", "Google - a@b.c", { ledgerSheetTitle: "Sổ thu chi", email: "a@b.c" })).toBe("Sổ thu chi (a@b.c)")
        expect(accountLabelOf("google", "Google - a@b.c", { email: "a@b.c" })).toBe("a@b.c")
        expect(accountLabelOf("google", "Google", { ledgerSheetTitle: " " })).toBe("Google")
    })

    it("names a Telegram bot by its handle, and a Zalo OA by its stored name or its id beside the connection's name", () => {
        expect(accountLabelOf("telegram", "Telegram", { bot_username: "nivo_bot" })).toBe("@nivo_bot")
        expect(accountLabelOf("telegram", "Telegram", {})).toBe("Telegram")
        expect(accountLabelOf("zalo_oa", "Zalo OA", { oa_id: "4318" })).toBe("Zalo OA · OA 4318")
        expect(accountLabelOf("zalo_oa", "Zalo OA", { oa_name: "Tiệm hoa NIVO", oa_id: "4318" })).toBe("Tiệm hoa NIVO")
        expect(accountLabelOf("meta", "Trang hoa", {})).toBe("Trang hoa")
    })
})
