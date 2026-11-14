import type { Namespaced, SpecLocale, SpecText } from "./schema.types"

/** `<namespace>.<name>` or `<domain>.<object>.<verb>`: two to four kebab-case ASCII parts. */
const NAMESPACED = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){1,3}$/

/** Whether a string is a well-formed registry id (a node, a block, a port, a job...). A NIVO verb is checked by `isNivoVerb` instead. */
export const isNamespaced = (value: string): value is Namespaced => NAMESPACED.test(value)

/** The levels of a NIVO verb: a workbench or provider-page operation, a tool a node may call, a trigger that heads a graph. */
export type NivoLevel = "api" | "tool" | "trigger"

/** The namespace every NIVO verb starts with. */
const NIVO_PREFIX = "nivo."

/**
 * The law of a NIVO verb: `nivo.<level>.<1-4 segments>`, level `api | tool | trigger`, each segment kebab-case ASCII. Nothing else is a
 * verb of NIVO.
 */
const NIVO_VERB = /^nivo\.(api|tool|trigger)((\.[a-z][a-z0-9-]*){1,4})$/

/** The level of a NIVO verb, or null when the string does not obey the law. */
export const levelOf = (value: string): NivoLevel | null => {
    const match = NIVO_VERB.exec(value)
    const level = match?.[1]
    return level === "api" || level === "tool" || level === "trigger" ? level : null
}

/**
 * The law of a CRM operation (owner chot 2026-11-13): `nivo.api.crm.<crmId>.<method>.<path segments>`, generated from the OpenAPI document a
 * package pinned (or a connection pinned) for that CRM id, never typed by hand. `<crmId>` is the FIXED, globally unique id of the CRM
 * (2 to 31 characters, `[a-z][a-z0-9-]*`), `<method>` the lower-case HTTP method, then the path's segments below its base path (a parameter
 * by its name, a camelCase name dashed), at most 12. ONE name serves a node (a tool it lists and calls) and an interface (a read it names).
 */
const CRM_OP = /^nivo\.api\.crm\.[a-z][a-z0-9-]{1,30}\.(get|post|put|patch|delete)(\.[a-z][a-z0-9-]*){0,12}$/

/** Whether a string is a CRM operation by the law (`nivo.api.crm.<crmId>.<method>.<path>`). */
export const isCrmOp = (value: string): value is `nivo.api.crm.${string}` => CRM_OP.test(value)

/**
 * Whether a string is a NIVO tool id by the law: a `nivo.tool.*` id, or a CRM operation (`isCrmOp`), the one `nivo.api.*` form a node may
 * call. Whether it is DECLARED is `ToolNames`' business, at compile time.
 */
export const isToolId = (value: string): value is `nivo.tool.${string}` | `nivo.api.crm.${string}` =>
    levelOf(value) === "tool" || isCrmOp(value)

/** Whether a string is a NIVO trigger verb by the law (`nivo.trigger.*`). */
export const isTriggerVerb = (value: string): value is `nivo.trigger.${string}` => levelOf(value) === "trigger"

/** Whether a string is a NIVO workbench operation by the law (`nivo.api.*`, a CRM operation included); only a CRM operation is also a tool. */
export const isApiVerb = (value: string): value is `nivo.api.${string}` => levelOf(value) === "api" || isCrmOp(value)

/**
 * Whether a string may name a tool where a tool is declared (a node's tools and effects, an agent's tools, `defineTool`): an id in NIVO's
 * namespace must be a tool id by the law (`isToolId`: a `nivo.tool.*` id or a CRM operation; any other `nivo.api.*` verb, a trigger or an
 * old `nivo.<domain>.*` id is refused); any other
 * id is a registry id (`isNamespaced`).
 */
export const isToolName = (value: string): value is Namespaced =>
    value.startsWith(NIVO_PREFIX) ? isToolId(value) : isNamespaced(value)

/** The namespace of an id: the part before the dot. */
export const namespaceOf = (id: Namespaced): string => id.slice(0, id.indexOf("."))

/** A registry id of exactly two kebab-case ASCII parts: the old form `<module>.<name>` modules not yet qualified still use. */
const MODULE_ID = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/

/**
 * The package-qualified form of a READ: `<package>.<agent>.api.<domain>.<query>`, each part kebab-case ASCII, such as
 * `blocks-core.booking.api.booking.list`. `<agent>` is the module key, `<domain>` the record domain the read serves.
 */
const QUALIFIED_READ = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.api\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/

/**
 * The package-qualified form of an entity or job NAME `<package>.<agent>.<domain>` (`blocks-core.video.project`) and of an ACTION id
 * `<package>.<agent>.<action>` (`blocks-core.booking.booking-confirm`, `<action>` = `<domain>-<verb>`): exactly three kebab-case ASCII
 * parts; the slot an id stands in (a name, an action) tells which it is.
 */
const QUALIFIED_NAME = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/

/** Whether a read id has the package-qualified form `<package>.<agent>.api.<domain>.<query>`. */
export const isQualifiedRead = (value: string): value is Namespaced => QUALIFIED_READ.test(value)

/** Whether an action id has the package-qualified form `<package>.<agent>.<action>`, exactly three parts. */
export const isQualifiedAction = (value: string): value is Namespaced => QUALIFIED_NAME.test(value)

/**
 * Whether a string may name a READ: the package-qualified form (five parts) or an old-form `<module>.<name>` id (exactly two parts).
 * Parts count tells the forms apart, so no old-form id can be misread as a qualified one: an id of three or four parts is no read.
 */
export const isReadId = (value: string): value is Namespaced => isQualifiedRead(value) || MODULE_ID.test(value)

/**
 * Whether a string may name an ACTION: the package-qualified form (three parts) or an old-form `<module>.<name>` id (exactly two
 * parts). Same part-count rule as names (`moduleKeyOfName`): an old-form id never has three parts.
 */
export const isActionId = (value: string): value is Namespaced => isQualifiedAction(value) || MODULE_ID.test(value)

/** Whether a string may name a module operation (a read or an action). */
export const isOperationId = (value: string): value is Namespaced => isReadId(value) || isActionId(value)

/**
 * The module key of a module operation id: the `<agent>` part (second) of a package-qualified read or action id, else the namespace of
 * an old-form `<module>.<name>` id (its first part); an id of no form has no module key (the empty string).
 */
export const moduleKeyOfOperation = (id: string): string => {
    const parts = id.split(".")
    if (isQualifiedRead(id) || isQualifiedAction(id)) return parts[1] ?? ""
    return MODULE_ID.test(id) ? (parts[0] ?? "") : ""
}

/** A spec text in the viewer's words: a key through the translator, owner-written words in the viewer's language. */
export const wordsOf = (text: SpecText, translate: (key: string) => string, locale: SpecLocale): string =>
    "key" in text ? translate(text.key) : text[locale]

/** Whether an entity or job name has the package-qualified form `<package>.<agent>.<domain>`. */
export const isQualifiedName = (value: string): boolean => QUALIFIED_NAME.test(value)

/**
 * The module key of an ENTITY or JOB name (a door operation id has `moduleKeyOfOperation`): the `<agent>` part (second) of a
 * package-qualified name of exactly three parts, else the first part of an old-form `<module>.<thing>` name. The ONE rule; the installation
 * keys plugins by their own key (`core`), not by package name, so the part count is what tells the forms apart.
 */
export const moduleKeyOfName = (name: string): string => {
    const parts = name.split(".")
    return (isQualifiedName(name) ? parts[1] : parts[0]) ?? ""
}
