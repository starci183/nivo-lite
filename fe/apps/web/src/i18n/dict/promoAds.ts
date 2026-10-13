import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** In-app promo cards for the Founding 50 campaign and Chatbot upsell. */
export const promoAds = defineDict("promoAds", { en: allEn["promoAds"], vi: allVi["promoAds"] })
