import type { QuotaStatus } from "./usage.contracts"

const format = (value: number): string => new Intl.NumberFormat("vi-VN").format(value)

/** The use of this month in one line: credits, top-up credits left, messages and tokens, each only when it applies. */
const useLine = (status: QuotaStatus): string =>
    [
        status.creditsLimit === null ? null : `${format(Math.round(status.creditsUsed))}/${format(status.creditsLimit)} credit`,
        status.topupBalance > 0 ? `${format(status.topupBalance)} credit n\u1ea1p th\u00eam c\u00f2n l\u1ea1i` : null,
        status.messagesLimit === null ? null : `${format(status.messagesUsed)}/${format(status.messagesLimit)} tin nh\u1eafn`,
        status.tokensLimit === null ? null : `${format(status.tokensUsed)}/${format(status.tokensLimit)} token`,
    ]
        .filter((part): part is string => part !== null)
        .join(", ")

/** The Office notice for a level: Vietnamese, because the owner reads it in the workspace inbox. Only warn and exceeded have one. */
export const noticeBody = (level: "warn" | "exceeded", status: QuotaStatus): string =>
    level === "warn"
        ? `M\u1ee9c d\u00f9ng AI th\u00e1ng n\u00e0y \u0111\u00e3 \u0111\u1ea1t ${Math.round(status.ratio * 100)}% h\u1ea1n m\u1ee9c (${useLine(status)}). Khi h\u1ebft h\u1ea1n m\u1ee9c, chatbot s\u1ebd chuy\u1ec3n c\u00e2u h\u1ecfi c\u1ee7a kh\u00e1ch cho nh\u00e2n vi\u00ean thay v\u00ec t\u1ef1 tr\u1ea3 l\u1eddi. N\u1ea1p th\u00eam credit ho\u1eb7c n\u00e2ng c\u1ea5p g\u00f3i t\u1ea1i Credit & g\u00f3i (/billing).`
        : `Workspace \u0111\u00e3 d\u00f9ng h\u1ebft h\u1ea1n m\u1ee9c AI c\u1ee7a th\u00e1ng n\u00e0y (${useLine(status)}). Chatbot t\u1ea1m d\u1eebng t\u1ef1 tr\u1ea3 l\u1eddi: kh\u00e1ch nh\u1eadn l\u1eddi x\u00e1c nh\u1eadn l\u1ecbch s\u1ef1 v\u00e0 c\u00e2u h\u1ecfi \u0111\u01b0\u1ee3c chuy\u1ec3n cho nh\u00e2n vi\u00ean. N\u1ea1p th\u00eam credit ho\u1eb7c n\u00e2ng c\u1ea5p g\u00f3i t\u1ea1i Credit & g\u00f3i (/billing) \u0111\u1ec3 chatbot ho\u1ea1t \u0111\u1ed9ng l\u1ea1i.`

/** The level a status asks to be announced at, or null when it is fine. */
export const noticeLevelOf = (status: QuotaStatus): "warn" | "exceeded" | null =>
    status.level === "ok" ? null : status.level
