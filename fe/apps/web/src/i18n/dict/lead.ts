import en from "@/modules/i18n/messages/en/lead.json"
import vi from "@/modules/i18n/messages/vi/lead.json"
import { defineDict } from "../core"

/** Lead detail panels: context, next step and owner, execution, outcome and history. */
export const lead = defineDict("lead", { en, vi })
