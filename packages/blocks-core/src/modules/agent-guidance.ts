import type { Bilingual } from "@nivo-lite/agent-sdk/module"
import { BOOKING_GUIDANCE } from "./booking/craft"
import { CHATBOT_GUIDANCE } from "./chatbot/craft"
import { CONTENT_GUIDANCE } from "./content/craft"
import { HIRING_GUIDANCE } from "./hiring/craft"
import { mindsetBrief } from "./mindset"
import { SALES_GUIDANCE } from "./sales/craft"
import { VIDEO_GUIDANCE } from "./video/craft"

/** The craft words of every module that has an agent, by module key: each module's own `craft.ts`. */
export const MODULE_CRAFT: Readonly<Record<string, Bilingual>> = {
    sales: SALES_GUIDANCE,
    chatbot: CHATBOT_GUIDANCE,
    hiring: HIRING_GUIDANCE,
    booking: BOOKING_GUIDANCE,
    video: VIDEO_GUIDANCE,
    content: CONTENT_GUIDANCE,
}

/**
 * The words an agent of a module works under, for every model call of its steps: the guidance of its module's craft (in the shop's
 * language), then the base mindset of the module. Empty for a module that has no agent. The engine puts this text in front of each
 * step's instructions (`NodeTurn.guidance`); the words live here, in blocks-core, never in the engine.
 *
 * No step appends the mindset to its own goal: this text is the one place it reaches the model.
 */
export const agentGuidanceOf = (moduleKey: string, locale: "vi" | "en"): string => {
    if (!Object.hasOwn(MODULE_CRAFT, moduleKey)) return ""
    const craft = MODULE_CRAFT[moduleKey]
    if (craft === undefined) return ""
    return [`${locale === "vi" ? "CH\u00cdNH S\u00c1CH" : "POLICY"}: ${craft[locale]}`, mindsetBrief(moduleKey)]
        .filter((part) => part !== "")
        .join("\n\n")
}
