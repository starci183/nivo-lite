import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy of the public points check (/l/<slug>): customer-facing, plain words. */
export const loyaltyPublic = defineDict("loyaltyPublic", { en: allEn["loyaltyPublic"], vi: allVi["loyaltyPublic"] })
