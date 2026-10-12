import en from "@/modules/i18n/messages/en/shifts.json"
import vi from "@/modules/i18n/messages/vi/shifts.json"
import { defineDict } from "../core"

/** Copy for the shifts workbench (/agents/shifts/workbench): week schedule, requests, setup, quick import and "Lịch của tôi". Vietnamese is the product language. */
export const shifts = defineDict("shifts", { en, vi })
