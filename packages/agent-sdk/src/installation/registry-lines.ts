import type { InstallationKind, InstallationPart, InstalledEntity, InstalledJob } from "./installation.types"

/** The version a definition declares; 0 for a definition that declares none. */
const versionOf = (definition: object): number =>
    "version" in definition && typeof definition.version === "number" ? definition.version : 0

/** Orders strings by code unit, so the same lists give the same text on every machine. */
const byCodeUnit = (left: string, right: string): number => {
    if (left === right) return 0
    return left < right ? -1 : 1
}

/** The line `<kind>:<id>@<version>`. */
const lineOf = (kind: InstallationKind, id: string, definition: object): string =>
    `${kind}:${id}@${versionOf(definition)}`

/**
 * The lines the registry hash is taken over, one per module, block, read, action, node, job and entity of the parts, sorted by code
 * unit: `<kind>:<id>@<version>`, the version being 0 when a definition declares none. Joined with newlines they are the text the
 * generator hashes, so a change of what is installed changes the hash and a reordering does not.
 */
export const registryLinesOf = <J extends InstalledJob, E extends InstalledEntity>(
    parts: ReadonlyArray<InstallationPart<J, E>>,
): ReadonlyArray<string> =>
    parts
        .flatMap((part) => [
            ...(part.modules ?? []).flatMap((module) => [
                lineOf("module", module.key, module),
                ...module.reads.map((read) => lineOf("read", read.id, read)),
                ...module.actions.map((action) => lineOf("action", action.id, action)),
            ]),
            ...(part.blocks ?? []).map((block) => lineOf("block", block.id, block)),
            ...(part.nodes ?? []).map((node) => lineOf("node", node.id, node)),
            ...(part.jobs ?? []).map((job) => lineOf("job", job.name, job)),
            ...(part.entities ?? []).map((entity) => lineOf("entity", entity.name, entity)),
        ])
        .sort(byCodeUnit)
