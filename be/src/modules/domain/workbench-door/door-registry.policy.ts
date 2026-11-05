import type { ActionDefinition, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { hasExternalPort } from "@nivo-lite/agent-sdk/invoke"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import type { PortMap } from "@nivo-lite/agent-sdk/port"
import { isNamespaced } from "@nivo-lite/agent-sdk/schema"
import { entityOfPortId, portKindOf } from "./door-port-kind.policy"
import { WorkbenchDoorError, WorkbenchDoorErrorCode } from "./errors/workbench-door.error"
import type { DoorRead, DoorRegistry } from "./workbench-door.contracts"

/** The first id that appears twice, or null when every id is unique. */
const duplicateOf = (ids: ReadonlyArray<string>): string | null =>
    ids.find((id, index) => ids.indexOf(id) !== index) ?? null

/** The data kind a read's rows are of: a counts read counts the rows of the list it names, so it takes that list's kind. */
const dataKindOf = (read: ReadDefinition, lists: ReadonlyMap<string, ReadDefinition>): string =>
    read.listing?.kind === "counts" ? (lists.get(read.listing.of)?.dataKind ?? read.dataKind) : read.dataKind

/** What is wrong with one port of a read or action, or null: the port is nothing provides, or it names data nobody declared. */
const portProblemOf = (
    port: PortMap[string],
    dataKind: string | null,
    entities: ReadonlyArray<EntityDefinition>,
): WorkbenchDoorErrorCode | null => {
    const kind = portKindOf(port.id)
    if (kind === "none") return WorkbenchDoorErrorCode.RegistryPortUnknown
    const entity = entityOfPortId(port.id)
    const missing =
        entity === null
            ? kind === "list" && !entities.some((declared) => declared.dataKind === dataKind)
            : !entities.some((declared) => declared.name === entity)
    return missing ? WorkbenchDoorErrorCode.RegistryEntityMissing : null
}

/** Refuses the first port of a read or action that nothing provides or that names data nobody declared. */
const assertPorts = (
    id: string,
    ports: PortMap | undefined,
    dataKind: string | null,
    entities: ReadonlyArray<EntityDefinition>,
): void => {
    for (const port of Object.values(ports ?? {})) {
        const code = portProblemOf(port, dataKind, entities)
        if (code !== null) throw new WorkbenchDoorError({ code, params: { id, port: port.id } })
    }
}

const readOf = (read: ReadDefinition, lists: ReadonlyMap<string, ReadDefinition>): Array<DoorRead> =>
    read.execute === undefined ? [] : [{ definition: read, dataKind: dataKindOf(read, lists) }]

const served = (action: ActionDefinition): boolean => action.execute !== undefined

/**
 * The reads and actions the door serves, from the module declarations and the entities. Only a read or action that runs in the package
 * (it has `execute`) is served; one that names a host operation is not the door's. Throws `WorkbenchDoorError` at boot, so a wiring bug
 * stops the start and never a request: an id that is taken twice (`RegistryDuplicate`) or is not `<module>.<name>`
 * (`RegistryIdInvalid`), a port nothing provides (`RegistryPortUnknown`), a list read or entity port whose entity nobody declared
 * (`RegistryEntityMissing`), or a transactional action that lists a port reaching outside the database (`ExternalInTx`).
 */
export const registryOf = (
    modules: ReadonlyArray<ModuleDeclaration>,
    entities: ReadonlyArray<EntityDefinition>,
): DoorRegistry => {
    const declaredReads = modules.flatMap((module) => module.reads)
    const declaredActions = modules.flatMap((module) => module.actions)
    const ids = [...declaredReads, ...declaredActions].map((entry) => entry.id)
    const duplicate = duplicateOf(ids)
    if (duplicate !== null)
        throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.RegistryDuplicate, params: { id: duplicate } })
    const malformed = ids.find((id) => !isNamespaced(id))
    if (malformed !== undefined)
        throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.RegistryIdInvalid, params: { id: malformed } })
    const lists = new Map(declaredReads.map((read) => [read.id, read]))
    const reads = declaredReads.flatMap((read) => readOf(read, lists))
    const actions = declaredActions.filter(served)
    for (const read of reads) assertPorts(read.definition.id, read.definition.ports, read.dataKind, entities)
    for (const action of actions) assertPorts(action.id, action.ports, null, entities)
    const external = actions.find((action) => action.transactional === true && hasExternalPort(action.ports))
    if (external !== undefined)
        throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.ExternalInTx, params: { action: external.id } })
    return {
        reads: new Map(reads.map((read) => [read.definition.id, read])),
        actions: new Map(actions.map((action) => [action.id, action])),
    }
}
