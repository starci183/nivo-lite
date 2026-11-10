import { AGENT_IDENTITY_RULES } from "@modules/domain/agents"

/** The handle a value that is no handle at all stands for. */
type OptionalName = string | null | undefined

/**
 * The base a new agent's @handle is drawn from: the role handle with the name after it ("sales-lan" for Lan of Sales), the name alone
 * when it already starts with the role ("Sales Lan"), or the role handle when the name gives no handle. The caller then takes the first
 * free one (base, base-2...).
 */
export const handleBaseOf = (name: OptionalName, roleHandle: string): string => {
    const fromName = typeof name === "string" ? AGENT_IDENTITY_RULES.handleSlug(name) : ""
    if (fromName === "" || fromName === roleHandle) return roleHandle
    const joined = (fromName.startsWith(`${roleHandle}-`) ? fromName : `${roleHandle}-${fromName}`).slice(
        0,
        AGENT_IDENTITY_RULES.handleLimits.max,
    )
    return AGENT_IDENTITY_RULES.cleanHandle(joined) ?? roleHandle
}
