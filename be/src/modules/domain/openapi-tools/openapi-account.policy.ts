import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { readDocument } from "./openapi-document.policy"
import { crmIdOfProviderKey } from "@nivo-lite/agent-sdk/names"
import type {
    AccountBase,
    ConnectionFacts,
    JsonMembers,
    OptionalAccountBase,
    OptionalAccountFacts,
    OptionalAccountKey,
    OptionalText,
    PinnedDocument,
    ToolsAccountFacts,
} from "./openapi-tools.contracts"

/** The public fact of a connection that holds what it says about the tools it serves, as JSON text. */
export const AGENT_TOOLS_KEY = "agentTools"

/** The public fact of a connection that holds the pinned document, as canonical JSON text. */
export const AGENT_DOCUMENT_KEY = "agentDocument"

/** The public fact the connection's own wizard keeps its configuration in (base URL, how the key is sent). */
const CONFIG_KEY = "config"

/** The version of the facts' shape. */
const FACTS_VERSION = 1

/** A header name. */
export const HEADER_NAME: RegExp = /^[A-Za-z][A-Za-z0-9-]{0,63}$/u

const SHA256 = /^[0-9a-f]{64}$/u

const jsonOf = (text: string | undefined): JsonMembers | null => {
    const read = parseJsonText(text ?? "")
    return read.ok && isRecord(read.value) ? read.value : null
}

const textOf = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

/** A base URL without the slashes it ends with. */
const withoutTrailingSlashes = (url: string): string => {
    let end = url.length
    while (end > 0 && url[end - 1] === "/") end -= 1
    return url.slice(0, end)
}

/** What a connection says about the tools it serves, or null when it says nothing usable (it then serves no tool). */
export const accountFactsOf = (meta: ConnectionFacts): OptionalAccountFacts => {
    const facts = jsonOf(meta[AGENT_TOOLS_KEY])
    if (facts?.v !== FACTS_VERSION) return null
    const connector = textOf(facts.connector)
    const workspaceHeader = textOf(facts.workspaceHeader)
    const documentSha256 = textOf(facts.documentSha256)
    if (crmIdOfProviderKey(connector) === null) return null
    if (!HEADER_NAME.test(workspaceHeader) || !SHA256.test(documentSha256)) return null
    return {
        connector,
        swaggerUrl: textOf(facts.swaggerUrl),
        workspaceHeader,
        documentSha256,
        live: facts.live === true,
        pinnedBy: textOf(facts.pinnedBy),
        pinnedAt: textOf(facts.pinnedAt),
    }
}

/** The pinned document of a connection as it was stored, or null when none is. */
export const pinnedTextOf = (meta: ConnectionFacts): OptionalText => {
    const text = meta[AGENT_DOCUMENT_KEY]
    return text === undefined || text.trim() === "" ? null : text
}

/**
 * The pinned document of a connection read for the CRM it serves (`accountFactsOf(meta).connector`), or null when it serves none, pinned
 * none, or its document cannot be read.
 */
export const pinnedReadingOf = (meta: ConnectionFacts): PinnedDocument | null => {
    const facts = accountFactsOf(meta)
    const text = pinnedTextOf(meta)
    if (facts === null || text === null) return null
    const reading = readDocument(text, facts.connector)
    return reading.ok ? reading.document : null
}

/**
 * The operations a connection's pin can call (the compatibility a readiness check and a call read): every operation of its pinned
 * document that uses no unsupported feature, by name (`nivo.api.crm.nivoweb.get.prices`); none when it pinned nothing readable.
 */
export const pinnedOpsOf = (meta: ConnectionFacts): ReadonlySet<string> => {
    const document = pinnedReadingOf(meta)
    if (document === null) return new Set()
    return new Set([...document.operations.values()].filter((op) => op.unsupported.length === 0).map((op) => op.toolId))
}

/** The two public facts of a pin: what the account says, and the document, each as the text stored. */
export const pinnedMetaOf = (facts: ToolsAccountFacts, documentText: string): ConnectionFacts => ({
    [AGENT_TOOLS_KEY]: JSON.stringify({ v: FACTS_VERSION, ...facts }),
    [AGENT_DOCUMENT_KEY]: documentText,
})

/**
 * Where the account's API is and how its key is sent, from the connection's own configuration; null when it is missing or the key
 * is sent another way than a named header or a bearer (a key in the query string would be written into addresses and logs).
 */
export const accountBaseOf = (meta: ConnectionFacts): OptionalAccountBase => {
    const config = jsonOf(meta[CONFIG_KEY])
    if (config === null) return null
    const baseUrl = withoutTrailingSlashes(textOf(config.baseUrl))
    const authName = textOf(config.authName)
    if (baseUrl === "") return null
    if (config.authType === "bearer") return { baseUrl, authType: "bearer", authName: "" }
    return config.authType === "header" && HEADER_NAME.test(authName) ? { baseUrl, authType: "header", authName } : null
}

/** The opened key of an account for its base, or null when the sealed credential holds none for that way of sending it. */
export const accountKeyOf = (credential: string, base: AccountBase): OptionalAccountKey => {
    const stored = jsonOf(credential)
    const value = typeof stored?.value === "string" ? stored.value : ""
    return value === "" ? null : { type: base.authType, name: base.authName, value }
}
