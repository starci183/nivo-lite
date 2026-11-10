import type { AiRouting } from "./ai.contracts"

/** The `provider` object of a chat body, as OpenRouter reads it: only the fields the routing names. */
export type ProviderField = Readonly<{
    order?: ReadonlyArray<string>
    only?: ReadonlyArray<string>
    sort?: AiRouting["sort"]
    allow_fallbacks?: boolean
}>

/**
 * The `provider` object a call's routing puts in the chat body, or null when the routing names nothing: the body then carries no
 * `provider` field at all and the endpoint routes the call as it likes. An empty list is no list.
 */
export const providerOf = (routing: AiRouting | undefined): ProviderField | null => {
    if (routing === undefined) return null
    const order = routing.order ?? []
    const only = routing.only ?? []
    const field: ProviderField = {
        ...(order.length === 0 ? {} : { order }),
        ...(only.length === 0 ? {} : { only }),
        ...(routing.sort === undefined ? {} : { sort: routing.sort }),
        ...(routing.allowFallbacks === undefined ? {} : { allow_fallbacks: routing.allowFallbacks }),
    }
    return Object.keys(field).length === 0 ? null : field
}

/** The `provider` field of the chat body: nothing at all without a routing. */
export const providerFieldOf = (routing: AiRouting | undefined): Readonly<Record<string, unknown>> => {
    const provider = providerOf(routing)
    return provider === null ? {} : { provider }
}
