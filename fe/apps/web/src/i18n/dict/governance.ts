import en from "@/modules/i18n/messages/en/governance.json"
import vi from "@/modules/i18n/messages/vi/governance.json"
import { defineDict } from "../core"

/** Shared operating-flow labels (departments, actions, gate reasons, statuses). Owned by L1; UI lanes import only. */
export const governance = defineDict("governance", { en, vi })
