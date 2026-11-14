/*
 * A CRM is a provider connected through its OpenAPI document (owner's decision 2026-11-13). Its id is FIXED and globally unique, declared by the
 * package that supports it and hard-coded there (`nivoweb`), never a per-connection name. Its provider key is `crm.<crmId>` and every one
 * of its operations is `nivo.api.crm.<crmId>.<method>.<path>`: one name a node calls and an interface reads alike, generated from the
 * pinned document (`api.generated.ts` of the package), never typed by hand.
 */

/** The first part of every CRM provider key: `crm.<crmId>`. */
export const CRM_PROVIDER_PREFIX = "crm." as const

/** The first part of every CRM operation: `nivo.api.crm.<crmId>....`. */
export const CRM_OP_PREFIX = "nivo.api.crm." as const

/** A CRM id: 2 to 31 characters, a lower-case letter then lower-case letters, digits or dashes. */
const CRM_ID = /^[a-z][a-z0-9-]{1,30}$/u

/** Whether a text is a CRM id by its form (`nivoweb`). */
export const isCrmId = (value: string): boolean => CRM_ID.test(value)

/** The provider key of a CRM: `crm.<crmId>` (`crm.nivoweb`). */
export const crmProviderKeyOf = <Id extends string>(crmId: Id): `crm.${Id}` => `${CRM_PROVIDER_PREFIX}${crmId}`

/** The CRM id of a provider key (`crm.nivoweb` gives `nivoweb`), or null when the key is no CRM's. */
export const crmIdOfProviderKey = (key: string): string | null => {
    if (!key.startsWith(CRM_PROVIDER_PREFIX)) return null
    const id = key.slice(CRM_PROVIDER_PREFIX.length)
    return isCrmId(id) ? id : null
}

/** The prefix of every operation of one CRM: `nivo.api.crm.<crmId>.`. */
export const crmOpPrefixOf = (crmId: string): string => `${CRM_OP_PREFIX}${crmId}.`

/** The CRM id an operation belongs to (`nivo.api.crm.nivoweb.get.prices` gives `nivoweb`), or null when it is no CRM operation. */
export const crmIdOfOp = (op: string): string | null => {
    if (!op.startsWith(CRM_OP_PREFIX)) return null
    const rest = op.slice(CRM_OP_PREFIX.length)
    const dot = rest.indexOf(".")
    if (dot < 0) return null
    const id = rest.slice(0, dot)
    return isCrmId(id) ? id : null
}
