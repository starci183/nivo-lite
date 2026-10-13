import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Public landing page (top half: nav, hero, trust strip, product, agent flow, connect). */
export const landing = defineDict("landing", { en: allEn["landing"], vi: allVi["landing"] })
