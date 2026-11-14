import type { AiBudget, AiChatRoute, ProfileRoutes } from "./ai.contracts"

/** The model id that serves a call, or null when it is not known. */
export type ServingModel = string | null

/** A call's budget, or none (the model's defaults). */
export type CallBudget = AiBudget | undefined

/** The `ChatAnthropic` constructor fields of a call's effort. */
export type EffortFields = Readonly<Record<string, unknown>>

/**
 * How a Claude model takes "thinking off", by the model id that serves the call (Anthropic API reference as the claude-api skill
 * holds it, 2026-11-03): `haiku-5-5` takes `thinking: {type: "disabled"}` at effort high or below; `sonnet-5-5` refuses `disabled`
 * and takes `{type: "between_tools"}` alone (no other thinking field), at effort high or below; `always-on` (Claude Opus 5.5, Fable,
 * Mythos) refuses any explicit thinking but adaptive, so only `output_config.effort` lowers it; `other` (an older or unknown Claude
 * id, or no id known) gets no `thinking` and the least effort.
 */
export type ClaudeFamily = "haiku-5-5" | "sonnet-5-5" | "always-on" | "other"

/** The family of a model id; anything not a known Claude id (a profile name, another vendor) is `other`. */
export const claudeFamilyOf = (model: ServingModel): ClaudeFamily => {
    if (model === null) return "other"
    if (model.startsWith("claude-haiku-5-5")) return "haiku-5-5"
    if (model.startsWith("claude-sonnet-5-5")) return "sonnet-5-5"
    if (/^claude-(opus-5-5|fable-|mythos-)/.test(model)) return "always-on"
    return "other"
}

/** The effort Anthropic takes (`output_config.effort`) for a lane effort that is not off: `minimal` is its least, `low`. */
const effortOf = (effort: Exclude<AiBudget["effort"], "off">): "low" | "medium" | "high" =>
    effort === "minimal" ? "low" : effort

/**
 * The `ChatAnthropic` constructor fields that carry a call's effort for the MODEL that serves it. Effort low, medium or high:
 * `output_config.effort` of that name and no `thinking` (adaptive), the same on every family. Effort off: Haiku 5.5
 * `thinking: {type: "disabled"}` (no effort sent: its default `medium` is within "high or below"); Sonnet 5.5
 * `thinking: {type: "between_tools"}` alone (its default effort `high` is within the limit); Opus 5.5 / Fable / Mythos and any other
 * id `output_config.effort: low`, no `thinking`. Never `budget_tokens`, a sampling field or a forced tool choice: not built here at
 * all. No budget: nothing (the model's defaults).
 */
export const anthropicThinkingFieldsOf = (model: ServingModel, budget: CallBudget): EffortFields => {
    if (budget === undefined) return {}
    if (budget.effort !== "off") return { outputConfig: { effort: effortOf(budget.effort) } }
    const family = claudeFamilyOf(model)
    if (family === "haiku-5-5") return { thinking: { type: "disabled" } }
    if (family === "sonnet-5-5") return { thinking: { type: "between_tools" } }
    return { outputConfig: { effort: "low" } }
}

/** What one try asks the gateway for and the effort fields built for the model that serves it. */
export interface ThinkingAsk {
    /** The profile or model the client names. */
    readonly name: string
    /** The model the body was built for; null when the name may be served by several models that all take this body. */
    readonly model: ServingModel
    /** The effort fields of the Anthropic client. */
    readonly fields: EffortFields
}

/**
 * The routes a name may be served by: the gateway's table for a profile (`routes`, given by the app from the pool it declares), the
 * name itself for a Claude model id, none for anything else.
 */
const routesOf = (name: string, routes: ProfileRoutes): ReadonlyArray<AiChatRoute> =>
    routes[name] ?? (name.startsWith("claude-") ? [{ model: name, profile: name }] : [])

/**
 * The name one try asks and the effort fields, decided by the model that will serve it. A name served by one model gets that model's
 * body. A profile that may be served by several models keeps the gateway's own failover when every candidate takes the same body
 * (any effort but off); when their bodies differ (effort off: Haiku `disabled`, Sonnet `between_tools`, each a 400 on the other), the
 * try is pinned to ONE candidate through its single-model profile and the body is built for it: the first candidate, and on a retry
 * that asks for the next route (`hop`) the second, with its body built again for that model. A name the routes do not know gets the
 * form every Claude model takes.
 */
export const thinkingAskOf = (name: string, budget: CallBudget, hop: boolean, routes: ProfileRoutes): ThinkingAsk => {
    const candidates = routesOf(name, routes)
    const [first] = candidates
    if (first === undefined) return { name, model: null, fields: anthropicThinkingFieldsOf(null, budget) }
    const bodies = candidates.map((route) => JSON.stringify(anthropicThinkingFieldsOf(route.model, budget)))
    if (bodies.every((body) => body === bodies[0])) {
        return {
            name,
            model: candidates.length === 1 ? first.model : null,
            fields: anthropicThinkingFieldsOf(first.model, budget),
        }
    }
    const pinned = (hop ? candidates[1] : undefined) ?? first
    return { name: pinned.profile, model: pinned.model, fields: anthropicThinkingFieldsOf(pinned.model, budget) }
}
