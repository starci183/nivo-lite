import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** The quiet "bản trên OpenClaw" block in module Settings, and the fixed line a customer gets when the engine's answer cannot be parsed. */
export const engine = defineDict("engine", { en: allEn["engine"], vi: allVi["engine"] })
