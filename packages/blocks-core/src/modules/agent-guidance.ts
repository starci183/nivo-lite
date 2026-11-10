import { mindsetBrief } from "./mindset"
import { MODULE_DECLARATIONS } from "./module-declarations"

/**
 * The words an agent of a module works under, for every model call of its steps: the policy guidance its module declares (in the
 * shop's language), then the base mindset of the module. Empty for a module that declares no agent. The engine puts this text in front
 * of each step's instructions (`NodeTurn.guidance`) and the shop's resolved policy values after it; the words live here, in
 * blocks-core, never in the engine. The declaration's default limits are not repeated: the engine gives the shop's own values.
 *
 * No step appends the mindset to its own goal: this text is the one place it reaches the model.
 */
export const agentGuidanceOf = (moduleKey: string, locale: "vi" | "en"): string => {
    const agent = MODULE_DECLARATIONS.find((module) => module.key === moduleKey)?.agent
    if (agent === undefined) return ""
    return [`${locale === "vi" ? "CHÍNH SÁCH" : "POLICY"}: ${agent.policy.guidance[locale]}`, mindsetBrief(moduleKey)]
        .filter((part) => part !== "")
        .join("\n\n")
}
