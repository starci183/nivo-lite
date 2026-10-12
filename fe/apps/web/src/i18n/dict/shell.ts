import en from "@/modules/i18n/messages/en/shell.json"
import vi from "@/modules/i18n/messages/vi/shell.json"
import { defineDict } from "../core"

/** Console chrome: top bar, sidebar, menus, notifications and route-level states. */
export const shell = defineDict("shell", { en, vi })
