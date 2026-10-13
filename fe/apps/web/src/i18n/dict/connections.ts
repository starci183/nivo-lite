import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** The Connections page (/connections), the per-agent "Kết nối dùng cho agent này" card in module Settings, and connection errors. */
export const connections = defineDict("connections", { en: allEn["connections"], vi: allVi["connections"] })
