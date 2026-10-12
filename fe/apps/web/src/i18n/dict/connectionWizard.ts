import en from "@/modules/i18n/messages/en/connectionWizard.json"
import vi from "@/modules/i18n/messages/vi/connectionWizard.json"
import { defineDict } from "../core"

/** The guided "Thêm kết nối" wizard frame: steps, environment choice, copy/paste helpers, first-transaction check, agent binding. */
export const connectionWizard = defineDict("connectionWizard", { en, vi })
