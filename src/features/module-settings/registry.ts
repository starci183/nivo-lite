import type { ComponentType } from "react";
import type { Installation } from "@/lib/modules-shared";
import { LoyaltyProgramExtras } from "@/features/module-loyalty/ProgramSettings";
import { ChatbotReplyExtras } from "./extras/ChatbotReplyExtras";

/** What a module's own settings extra receives (rendered under the common settings cards of /m/<module>/settings). */
export type SettingsExtraProps = { readonly installation: Installation; readonly canEdit: boolean };

/**
 * Module settings extras: settings_extras key (resources/modules/<key>/module.json) -> a client component.
 * A new module adds ONE line here (and sets "settings_extras" in its module.json); a module without extras needs nothing.
 */
export const SETTINGS_EXTRAS: Readonly<Record<string, ComponentType<SettingsExtraProps>>> = {
  chatbot_reply: ChatbotReplyExtras,
  loyalty_program: LoyaltyProgramExtras,
};
