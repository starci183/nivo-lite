import { SdkDefinitionError } from "../block/definition-error"
import type {
    Installation,
    InstallationKind,
    InstallationPart,
    InstalledEntity,
    InstalledJob,
} from "./installation.types"

/** The first id that occurs twice in a list, or null. */
const repeated = (ids: ReadonlyArray<string>): string | null => {
    const seen = new Set<string>()
    for (const id of ids) {
        if (seen.has(id)) return id
        seen.add(id)
    }
    return null
}

/** Refuses an id that two parts, or one part twice, declare for the same kind. */
const assertUnique = (kind: InstallationKind, ids: ReadonlyArray<string>): void => {
    const twice = repeated(ids)
    if (twice !== null) throw new SdkDefinitionError("INSTALLATION_ID_DUPLICATE", `${kind}:${twice}`)
}

/**
 * Joins the lists of every package into the one installation the front end, the door, the graph host, the job runner and the entity
 * engine are wired from. Throws `SdkDefinitionError` `INSTALLATION_ID_DUPLICATE` (at `<kind>:<id>`) when two modules share a key, two
 * blocks, nodes, jobs or entities share an id, or two reads or two actions share an id, across any parts. A module's ids already
 * start with its key (`defineModule`), so one module key per installation keeps reads and actions apart. The registry hash is the
 * one the generator computed; the generated package holds it as a literal, because the browser bundle may not hash.
 */
export const defineInstallation = <J extends InstalledJob = InstalledJob, E extends InstalledEntity = InstalledEntity>(
    parts: ReadonlyArray<InstallationPart<J, E>>,
    registryHash: string,
): Installation<J, E> => {
    const modules = parts.flatMap((part) => part.modules ?? [])
    const blocks = parts.flatMap((part) => part.blocks ?? [])
    const nodes = parts.flatMap((part) => part.nodes ?? [])
    const jobs = parts.flatMap((part) => part.jobs ?? [])
    const entities = parts.flatMap((part) => part.entities ?? [])
    assertUnique(
        "module",
        modules.map((module) => module.key),
    )
    assertUnique(
        "read",
        modules.flatMap((module) => module.reads.map((read) => read.id)),
    )
    assertUnique(
        "action",
        modules.flatMap((module) => module.actions.map((action) => action.id)),
    )
    assertUnique(
        "block",
        blocks.map((block) => block.id),
    )
    assertUnique(
        "node",
        nodes.map((node) => node.id),
    )
    assertUnique(
        "job",
        jobs.map((job) => job.name),
    )
    assertUnique(
        "entity",
        entities.map((entity) => entity.name),
    )
    return { modules, blocks, nodes, jobs, entities, registryHash }
}
