import type { GenMessage } from "@modules/domain/ai-generations"
import type { CampaignParams } from "../loyalty-campaigns.contracts"

/** The constrained prompt carries only the owner's offer and the safe template with the business name. */
export const campaignDraftPrompt = (params: CampaignParams, template: string): ReadonlyArray<GenMessage> => [
    {
        role: "system",
        content: [
            "Write one Vietnamese loyalty promotion message for a customer chat, warm and plain, at most 60 words.",
            "Start with {ten_khach}. Only {ten_khach}, {ten_shop}, {diem} and {hang} placeholders are allowed.",
            "Use no markdown. Mention only the owner's offer. Never invent a discount, gift, price, date or condition.",
            "If the owner supplied no offer, write a friendly thank-you without an offer. End with one easy next step.",
            "Output only the message. The template supplies the accurate business name; its wording is not an extra offer.",
        ].join("\n"),
    },
    {
        role: "user",
        content: [
            `Campaign name: ${params.name}`,
            `Target segment: ${JSON.stringify(params.segment)}`,
            `Owner's offer: ${params.brief.trim() === "" ? "(none)" : params.brief.trim()}`,
            `Business template: ${template}`,
        ].join("\n"),
    },
]

/** Unusable model output leaves the proven template in place. */
export const campaignDraftText = (output: string | null, template: string): string => {
    const text =
        output
            ?.trim()
            .replace(/^["“”']|["“”']$/gu, "")
            .trim() ?? ""
    if (text === "" || text.length > 700 || /\*\*|^#|```/mu.test(text) || !text.includes("{ten_khach}")) return template
    if (/\{(?!ten_khach\}|ten_shop\}|diem\}|hang\})[^{}]+\}/u.test(text)) return template
    return text
}
