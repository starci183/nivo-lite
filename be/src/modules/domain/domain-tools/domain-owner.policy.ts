import type { ConnectionRecord } from "@modules/domain/connections"
import { registrarRefusalReason, type DomainRecord } from "@modules/domain/provider-registry"

/**
 * WHICH ACCOUNT a domain operation acts on. The DATA decides first: an operation on a domain the workspace already holds (renew, read,
 * DNS, nameservers) acts on the registrar account that HOLDS it, whatever account the node's order put first; only when no account
 * holds it, or the operation is about a name not held yet (availability, registration, transfer, a list), does the node's order decide:
 * the account the tool runner handed the call, else the workspace's only registrar account. Never a silent pick between several.
 */

/** The workspace's registrar accounts a call may use: the handed one first, then the others oldest first; none disconnected. */
export const candidatesOf = (
    connections: ReadonlyArray<ConnectionRecord>,
    served: (provider: string) => boolean,
    handed: string | undefined,
): ReadonlyArray<ConnectionRecord> => {
    const usable = connections.filter((connection) => connection.status !== "disconnected" && served(connection.provider))
    const first = usable.filter((connection) => connection.id === handed)
    return [...first, ...usable.filter((connection) => connection.id !== handed)]
}

/** The account that holds a domain, with the domain as it holds it. */
export interface HeldDomain {
    /** The holding account. */
    readonly connection: ConnectionRecord
    /** The domain at that account. */
    readonly domain: DomainRecord
}

/**
 * The FIRST candidate that holds the domain (`find` of its provider's port), asked in the candidates' order; null when none does. An
 * account that cannot serve the purpose (`not_available`: no key, another key context) is passed over, never a reason to stop.
 */
export const holderOf = async (
    candidates: ReadonlyArray<ConnectionRecord>,
    find: (connection: ConnectionRecord) => Promise<DomainRecord | null>,
): Promise<HeldDomain | null> => {
    for (const connection of candidates) {
        let domain: DomainRecord | null
        try {
            domain = await find(connection)
        } catch (cause) {
            if (registrarRefusalReason(cause) === "not_available") continue
            throw cause
        }
        if (domain !== null) return { connection, domain }
    }
    return null
}

/** The account for a name not held: the handed one, else the only candidate; `none` or `ambiguous` otherwise. */
export const accountForNew = (
    candidates: ReadonlyArray<ConnectionRecord>,
    handed: string | undefined,
): ConnectionRecord | "none" | "ambiguous" => {
    const picked = candidates.find((connection) => connection.id === handed)
    if (picked !== undefined) return picked
    const [only, second] = candidates
    if (only === undefined) return "none"
    return second === undefined ? only : "ambiguous"
}
