import type { Bilingual } from "@nivo-lite/agent-sdk/module"

/**
 * The policy words every agent of NIVO works under, before its own: a business choice the policy does not settle is the founder's, asked
 * in the team chat, never guessed.
 */
export const ASK_THE_FOUNDER: Bilingual = {
    vi: "Khi chính sách không nói rõ, hỏi chủ tiệm ở /chat rồi làm theo câu trả lời.",
    en: "When the policy does not say, ask the founder in /chat and follow the answer.",
}

/** An amount of VND in the words of one language: `5.000.000đ`, `5,000,000 VND`. */
export const vndOf = (amountVnd: number, locale: "vi" | "en"): string =>
    locale === "vi"
        ? `${new Intl.NumberFormat("vi-VN").format(amountVnd)}đ`
        : `${new Intl.NumberFormat("en-US").format(amountVnd)} VND`

/** The guidance of an agent: its own rules, then the rule every agent shares. */
export const guidanceOf = (own: Bilingual): Bilingual => ({
    vi: `${own.vi} ${ASK_THE_FOUNDER.vi}`,
    en: `${own.en} ${ASK_THE_FOUNDER.en}`,
})
