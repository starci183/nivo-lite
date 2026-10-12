import en from "@/modules/i18n/messages/en/connections.json"
import vi from "@/modules/i18n/messages/vi/connections.json"
import { defineDict } from "../core"

/** The Connections page (/connections), the per-agent "Kết nối dùng cho agent này" card in module Settings, and connection errors. */
export const connections = defineDict("connections", { en, vi })
