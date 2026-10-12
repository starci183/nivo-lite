import en from "@/modules/i18n/messages/en/loyaltyPublic.json"
import vi from "@/modules/i18n/messages/vi/loyaltyPublic.json"
import { defineDict } from "../core"

/** Copy of the public points check (/l/<slug>): customer-facing, plain words. */
export const loyaltyPublic = defineDict("loyaltyPublic", { en, vi })
