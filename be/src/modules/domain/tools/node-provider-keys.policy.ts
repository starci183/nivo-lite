import { OPENAPI_PROVIDER, accountFactsOf } from "@modules/domain/openapi-tools"
import { eachInOrder } from "@modules/platform/primitives"

/** One attached account as the accounts of a node NAME it: the connection, and the provider key a node lists for it. */
export interface NodeAccountKey {
    /** The connected account. */
    readonly connectionId: string
    /** The key a node names it by: the provider (`zalo_oa`), or for an OpenAPI account the source key its pinned document serves (`crm`). */
    readonly provider: string
}

/** The provider key a node names an account by, or null for an account no node can name (an OpenAPI account pinned to no source). */
export type OptionalNodeProviderKey = string | null

/**
 * THE MAPPING "the provider key of an attached account as nodes name it": an account of the OpenAPI provider is named by the source key
 * its PINNED document declares (`accountFactsOf(meta).connector`, the key a template node lists, `crm`); an OpenAPI account with no pin
 * (or a pin that does not read) serves no source and is named by none; any other account by its own provider. Read where attachments
 * are matched to the providers of nodes (the binding, readiness, the row writers, the runner's bound list, the node-level judge); a
 * stored row (`mcp_connector_access.provider`, a tick, a node row) is never rewritten by it.
 */
export const nodeProviderKeyOf = (
    provider: string,
    meta: Readonly<Record<string, string>> | null,
): OptionalNodeProviderKey => {
    if (provider !== OPENAPI_PROVIDER) return provider
    return meta === null ? null : (accountFactsOf(meta)?.connector ?? null)
}

/** What the mapping reads of a connection: its public facts (where the pin of an OpenAPI account is). */
export interface ConnectionMetaReader {
    /** The connection of the workspace, or null when it holds none of that id. */
    recordOf(
        workspaceId: string,
        connectionId: string,
    ): Promise<{ readonly meta: Readonly<Record<string, string>> } | null>
}

/** An attachment as the mapping reads it. */
interface Attached {
    readonly connectionId: string
    readonly provider: string
}

/**
 * The key nodes name each OpenAPI account by, keyed by connection (null: named by none); only OpenAPI accounts are read, each once.
 * Undefined when the app binds no reader of connections: the pins cannot be read, so every account keeps its own provider (as before).
 */
export const nodeKeysOf = async (
    workspaceId: string,
    accounts: ReadonlyArray<Attached>,
    reader: ConnectionMetaReader | undefined,
): Promise<ReadonlyMap<string, OptionalNodeProviderKey> | undefined> => {
    if (reader === undefined) return undefined
    const keys = new Map<string, OptionalNodeProviderKey>()
    const pinned = [...new Set(accounts.filter((account) => account.provider === OPENAPI_PROVIDER).map((account) => account.connectionId))]
    await eachInOrder(pinned, async (connectionId) => {
        const record = await reader.recordOf(workspaceId, connectionId)
        keys.set(connectionId, nodeProviderKeyOf(OPENAPI_PROVIDER, record?.meta ?? null))
    })
    return keys
}

/** The key one account is named by under the keys read (`nodeKeysOf`): its own provider when none was read for it. */
export const keyUnder = (
    account: Attached,
    keys: ReadonlyMap<string, OptionalNodeProviderKey> | undefined,
): OptionalNodeProviderKey => (keys?.has(account.connectionId) === true ? (keys.get(account.connectionId) ?? null) : account.provider)

/**
 * The accounts as nodes name them, in their order: each by its own provider (what a node written before sources named, `openapi`), and
 * an OpenAPI account pinned to a source ALSO by that source, right after (the key a template node lists, `crm`; a reader that keeps one
 * key per account keeps the source's). An OpenAPI account pinned to none is named by its own provider alone: it matches no source.
 */
export const namedAccountsOf = (
    accounts: ReadonlyArray<Attached>,
    keys: ReadonlyMap<string, OptionalNodeProviderKey> | undefined,
): ReadonlyArray<NodeAccountKey> =>
    accounts.flatMap((account) => {
        const own = { connectionId: account.connectionId, provider: account.provider }
        const key = keyUnder(account, keys)
        return key === null || key === account.provider ? [own] : [own, { connectionId: account.connectionId, provider: key }]
    })

/** `namedAccountsOf` after reading the pins of the OpenAPI accounts among them (`nodeKeysOf`). */
export const accountsAsNodesName = async (
    workspaceId: string,
    accounts: ReadonlyArray<Attached>,
    reader: ConnectionMetaReader | undefined,
): Promise<ReadonlyArray<NodeAccountKey>> => namedAccountsOf(accounts, await nodeKeysOf(workspaceId, accounts, reader))
