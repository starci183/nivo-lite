import en from "@/modules/i18n/messages/en/access.json"
import vi from "@/modules/i18n/messages/vi/access.json"
import { defineDict } from "../core"

/** Roles and permission errors (workspace members: owner, manager, staff). */
export const access = defineDict("access", { en, vi })
