import type { ReadDefinition } from "../block/block.types"
import type { AnyEntityDefinition } from "../entity/entity-any.types"
import { ENTITIES_PORT_ID, ENTITY_PORT_PREFIX } from "../entity/port/entity-port"
import { agentOfRecordType } from "../entity/record-scope"
import { isQualifiedName, isQualifiedRead, moduleKeyOfOperation } from "../schema/namespaced"
import type { InstallationPart, InstalledJob } from "./installation.types"

/** A part as the law reads it: its record types are the entity engine's own declarations (their refs are read). */
type LawPart = InstallationPart<InstalledJob, AnyEntityDefinition>

/**
 * The codes of the records frame's name law (records.md): a record type is `<package>.<agent>.<domain>` and a record read
 * `<package>.<agent>.api.<domain>.<query>`, `<package>` the declaring plugin's package name and `<agent>` a template agent it declares;
 * a ref and a read reach only types of their own agent.
 */
export type RecordLawCode =
    /** The plugin declares record types or record reads and names no `packageName`. */
    | "PLUGIN_PACKAGE_NAME_MISSING"
    /** A record type name that is not three kebab-case parts (an old short form such as `sales.order`). */
    | "RECORD_TYPE_NAME_FORMAT"
    /** A record type whose first part is not the declaring plugin's package name. */
    | "RECORD_TYPE_PACKAGE"
    /** A record type whose agent part is no template agent the plugin declares. */
    | "RECORD_TYPE_AGENT"
    /** A ref to a type of another agent. */
    | "RECORD_REF_OTHER_AGENT"
    /** A record read whose id is not `<package>.<agent>.api.<domain>.<query>`. */
    | "RECORD_QUERY_NAME_FORMAT"
    /** A record read whose first part is not the declaring plugin's package name. */
    | "RECORD_QUERY_PACKAGE"
    /** A record read whose agent part is no template agent the plugin declares. */
    | "RECORD_QUERY_AGENT"
    /** A record read that reaches a type of another agent, or every type (`engine.entities`). */
    | "RECORD_QUERY_OTHER_AGENT"

/** One offence: the code, the plugin that declares it (its owner) and what it is about. */
export interface RecordLawProblem {
    /** The code. */
    readonly code: RecordLawCode
    /** The key of the plugin that declares it. */
    readonly plugin: string
    /** The type, the read id, `<type>.relations.<name>`, or the plugin key. */
    readonly at: string
    /** The other side: the type a ref or a read reaches. */
    readonly detail?: string
}

/** The name a part is reported under: its key, or `part<index>` for a part that names none (as the installation does). */
const ownerOf = (part: LawPart, index: number): string => part.key ?? `part${index}`

/** The record types a read reaches through its ports: each `engine.entity.<type>`, and `engine.entities` (every type). */
const reachedOf = (read: ReadDefinition): ReadonlyArray<string> =>
    Object.values(read.ports ?? {}).flatMap((port) => {
        if (port.id === ENTITIES_PORT_ID) return [ENTITIES_PORT_ID]
        return port.id.startsWith(ENTITY_PORT_PREFIX) ? [port.id.slice(ENTITY_PORT_PREFIX.length)] : []
    })

/** The checks of one part, in a fixed order: the plugin, its types, their refs, its record reads. */
const partProblems = (part: LawPart, index: number): ReadonlyArray<RecordLawProblem> => {
    const plugin = ownerOf(part, index)
    const agents = new Set((part.templateAgents ?? []).map((agent) => agent.key))
    const own = part.entities ?? []
    const reads = (part.modules ?? []).flatMap((module) => module.reads).filter((read) => reachedOf(read).length > 0)
    const problems: Array<RecordLawProblem> = []
    const report = (code: RecordLawCode, at: string, detail?: string): void => {
        problems.push({ code, plugin, at, ...(detail === undefined ? {} : { detail }) })
    }
    if ((own.length > 0 || reads.length > 0) && part.packageName === undefined) report("PLUGIN_PACKAGE_NAME_MISSING", plugin)
    const placed = (name: string, qualified: boolean, codes: readonly [RecordLawCode, RecordLawCode, RecordLawCode]): void => {
        const [format, pkg, agent] = codes
        const parts = name.split(".")
        if (!qualified) {
            report(format, name)
            return
        }
        if (parts[0] !== part.packageName) report(pkg, name)
        if (!agents.has(parts[1] ?? "")) report(agent, name)
    }
    for (const entity of own) {
        placed(entity.name, isQualifiedName(entity.name), ["RECORD_TYPE_NAME_FORMAT", "RECORD_TYPE_PACKAGE", "RECORD_TYPE_AGENT"])
    }
    for (const entity of own) {
        for (const [name, relation] of Object.entries(entity.relations ?? {})) {
            if (agentOfRecordType(relation.target) !== agentOfRecordType(entity.name)) {
                report("RECORD_REF_OTHER_AGENT", `${entity.name}.relations.${name}`, relation.target)
            }
        }
    }
    for (const read of reads) {
        placed(read.id, isQualifiedRead(read.id), ["RECORD_QUERY_NAME_FORMAT", "RECORD_QUERY_PACKAGE", "RECORD_QUERY_AGENT"])
        const agent = moduleKeyOfOperation(read.id)
        for (const reached of reachedOf(read)) {
            if (reached === ENTITIES_PORT_ID || agentOfRecordType(reached) !== agent) {
                report("RECORD_QUERY_OTHER_AGENT", read.id, reached)
            }
        }
    }
    return problems
}

/**
 * Every offence of the installed parts against the records frame's name law, each with its owner: record types, their refs and the
 * reads that reach records (a read with an entity port). Pure; the
 * project check `record-names` prints them (and proves each `packageName` against the package's own `package.json`). Empty = clean.
 */
export const recordLawProblems = (parts: ReadonlyArray<LawPart>): ReadonlyArray<RecordLawProblem> =>
    parts.flatMap((part, index) => partProblems(part, index))
