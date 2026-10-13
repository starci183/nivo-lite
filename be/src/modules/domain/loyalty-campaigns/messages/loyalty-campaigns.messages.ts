import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the loyalty campaigns codes and the wording of a campaign draft, Vietnamese and English. */
export const LOYALTY_CAMPAIGNS_MESSAGES: MessageBundle = {
    vi: {
        "errors.LOYALTY_CAMPAIGNS_NO_RECIPIENTS": "Không có khách nào khớp bộ lọc này.",
        "errors.LOYALTY_CAMPAIGNS_NOT_CREATED": "Chưa tạo được chiến dịch, bạn thử lại nhé.",
        "loyalty.promo.template": "Chào {ten_khach}, {{shop}} có ưu đãi dành riêng cho bạn: {{offer}}",
        "loyalty.promo.defaultOffer": "ưu đãi riêng cho khách thân thiết",
        "loyalty.campaign.defaultName": "Ưu đãi {{segment}}",
        "loyalty.segment.all": "tất cả khách thân thiết",
        "loyalty.segment.tiers": "hạng {{tiers}}",
        "loyalty.segment.inactive": "lâu không quay lại (từ {{days}} ngày)",
        "loyalty.segment.birthday": "sinh nhật trong tháng này",
        "loyalty.segment.minSpend": "đã chi từ {{amount}} ₫",
    },
    en: {
        "errors.LOYALTY_CAMPAIGNS_NO_RECIPIENTS": "No customer matches this filter.",
        "errors.LOYALTY_CAMPAIGNS_NOT_CREATED": "The campaign could not be created, please try again.",
        "loyalty.promo.template": "Hello {ten_khach}, {{shop}} has an offer just for you: {{offer}}",
        "loyalty.promo.defaultOffer": "a special offer for loyal customers",
        "loyalty.campaign.defaultName": "Offer for {{segment}}",
        "loyalty.segment.all": "all loyalty customers",
        "loyalty.segment.tiers": "tier {{tiers}}",
        "loyalty.segment.inactive": "not back for a while (from {{days}} days)",
        "loyalty.segment.birthday": "birthday this month",
        "loyalty.segment.minSpend": "spent from {{amount}} VND",
    },
}
