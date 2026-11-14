import type { NodeToolAccount } from "@modules/domain/graph-nodes"
import type { SubjectRef } from "@nivo-lite/agent-sdk/node"
import { ENVELOPE_ANSWERS, OUTSIDE_REFUSAL_CLASS, outsideRefusalOf, outsideSuccessOf } from "@modules/domain/openapi-tools"
import type { ToolCallResult } from "./tools.contracts"

/** A gateway answer that is a value. */
type GatewayValue = Extract<ToolCallResult, { ok: true }>

/** The refusal fact a business refusal of a tool is answered as (a template node's `ok: false`): its code and its facts, with the tool. */
export const refusedOf = (tool: string, id: string, facts: Readonly<Record<string, unknown>>): SubjectRef => ({
    kind: "refused",
    id,
    facts: { ...facts, tool },
})

/** What the template road hands the node for a gateway value: the value to answer, or an envelope this door cannot read. */
export type TemplateValue = { readonly kind: "value"; readonly value: unknown } | { readonly kind: "unreadable" }

/**
 * The value of a gateway answer on the TEMPLATE road (a call that asks for refusals as answers):
 * - the outside system's own refusal of an operation (`outsideRefusalOf`, which `OUTSIDE_REFUSAL_CLASS` classes) as the refusal fact;
 * - a success of a connector whose manifest says every answer is the OpenAPI envelope (`answers: "envelope"`, the gateway's typed mark,
 *   never the shape of the value) as the node's `ToolAnswer`: `value` is the BODY the outside system answered (the envelope's `data`),
 *   `meta` the envelope's status, what was cut (`truncated`, `omitted`) and its facts (the notice, a dry run), never mixed into the body;
 *   `via` the account the runner handed the call, else none. A marked answer that is neither is `unreadable` (the step freezes);
 * - any other value as it is (a NIVO tool's own answer, whatever its members).
 */
export const templateValueOf = (tool: string, result: GatewayValue, account?: NodeToolAccount): TemplateValue => {
    const outside = OUTSIDE_REFUSAL_CLASS === "business" ? outsideRefusalOf(result.value) : null
    if (outside !== null) return { kind: "value", value: refusedOf(tool, outside.code, outside.facts) }
    if (result.answers !== ENVELOPE_ANSWERS) return { kind: "value", value: result.value }
    const success = outsideSuccessOf(result.value)
    if (success === null) return { kind: "unreadable" }
    const via =
        account === undefined
            ? { provider: null, connectionId: null }
            : { provider: account.provider, connectionId: account.connectionId }
    return { kind: "value", value: { ok: true, value: success.body, via, meta: success.meta } }
}
