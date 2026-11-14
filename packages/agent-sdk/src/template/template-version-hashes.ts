import { createHash } from "node:crypto"

/** What the check reads of a template as its author wrote it: its id and the graph of each version. */
export interface RawTemplateVersions {
    /** The template id. */
    readonly id: string
    /** The versions, each with its number and its graph. */
    readonly versions: ReadonlyArray<{ readonly version: number; readonly graph?: unknown }>
}

/** The recorded hash of each published version, by template id and version number (a package's `template-version-hashes.json`). */
export type RecordedTemplateHashes = Readonly<Record<string, Readonly<Record<string, string>>>>

/** What the check found: the versions with no recorded hash (as the line to record) and the versions edited in place. */
export interface TemplateVersionProblems {
    /** One `"<id>": { "<version>": "<hash>" }` per shipped version that has no recorded hash. */
    readonly missing: ReadonlyArray<string>
    /** One `<id> v<n>: publish the change as v<n+1>` per shipped version whose graph no longer has its recorded hash. */
    readonly changed: ReadonlyArray<string>
}

/** The JSON of a value with its object keys sorted by code unit, so the hash reads content, never key order. */
const byCodeUnit = (left: string, right: string): number => {
    if (left === right) return 0
    return left < right ? -1 : 1
}

const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map((one) => canonical(one)).join(",")}]`
    if (value !== null && typeof value === "object") {
        const entries = Object.entries(value).filter(([, one]) => one !== undefined)
        entries.sort(([a], [b]) => byCodeUnit(a, b))
        const members = entries.map(([key, one]) => `${JSON.stringify(key)}:${canonical(one)}`)
        return `{${members.join(",")}}`
    }
    return JSON.stringify(value)
}

/** The hash a published template version is recorded under: sha-256 of its graph, keys in order. */
export const templateGraphHash = (graph: unknown): string => createHash("sha256").update(canonical(graph)).digest("hex")

/**
 * The rule every package that ships workflow templates holds, the core package and a plugin alike: a published template version never
 * changes. A workflow made from it keeps `{ templateId, templateVersion }` as provenance and is offered only a HIGHER version, so a
 * graph edited in place reaches no installed workflow. The graph of every shipped version (as its author wrote it) is hashed against
 * the package's recorded hashes, written once when the version is published: an edit is `changed` until it ships as a new version,
 * and a new version is `missing` until its hash is recorded.
 */
export const templateVersionProblems = (
    raw: ReadonlyArray<RawTemplateVersions>,
    recorded: RecordedTemplateHashes,
): TemplateVersionProblems => ({
    missing: raw.flatMap((template) =>
        template.versions
            .filter((one) => recorded[template.id]?.[String(one.version)] === undefined)
            .map((one) => `"${template.id}": { "${one.version}": "${templateGraphHash(one.graph)}" }`),
    ),
    changed: raw.flatMap((template) =>
        template.versions
            .filter((one) => {
                const hash = recorded[template.id]?.[String(one.version)]
                return hash !== undefined && hash !== templateGraphHash(one.graph)
            })
            .map((one) => `${template.id} v${one.version}: publish the change as v${one.version + 1}`),
    ),
})
