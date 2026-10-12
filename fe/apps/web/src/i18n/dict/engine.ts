import en from "@/modules/i18n/messages/en/engine.json"
import vi from "@/modules/i18n/messages/vi/engine.json"
import { defineDict } from "../core"

/** The quiet "bản trên OpenClaw" block in module Settings, and the fixed line a customer gets when the engine's answer cannot be parsed. */
export const engine = defineDict("engine", { en, vi })
