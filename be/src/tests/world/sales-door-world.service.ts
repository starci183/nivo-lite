import assert from "node:assert/strict"
import { DataSource } from "typeorm"
import type { EntityManager } from "typeorm"
import { LeadEffectsService, OrderEffectsService } from "@modules/domain/sales-effects"
import { WorkbenchDoorService } from "@modules/domain/workbench-door"
import { PRIMARY_ENTITIES } from "@modules/platform/database/entities"
import { parseJsonText } from "@modules/platform/primitives"
import { seedDatabaseUrl } from "./backend-role-sandbox.service"
import type { LiteWorld } from "./lite-world.service"

/** What a call to the door carries: the variables of a read or the input of an action. */
export type DoorPayload = Readonly<Record<string, unknown>>

/** What a read answered or an action answered, as an object. */
export type DoorObject = Readonly<Record<string, unknown>>

/** A superuser connection to the database the world runs on, for what a proof seeds and reads back past the row-level policies. */
export interface SeedConnection {
    /** The manager of the connection; open once the suite started. */
    readonly manager: EntityManager
}

/** Opens the seed connection before the suite and closes it after, so the suite keeps no connection of its own. */
export const useSeedConnection = (world: LiteWorld): SeedConnection => {
    const source = new DataSource({
        type: "postgres",
        url: seedDatabaseUrl(),
        entities: [...PRIMARY_ENTITIES],
        uuidExtension: "pgcrypto",
        synchronize: false,
    })
    beforeAll(async () => {
        await source.initialize()
        world.cleanup(() => source.destroy())
    })
    return {
        get manager(): EntityManager {
            return source.manager
        },
    }
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const jsonOf = (text: string): unknown => {
    const parsed = parseJsonText(text)
    assert(parsed.ok, "The door must answer JSON text")
    return parsed.value
}

const objectOf = (value: unknown): DoorObject => {
    assert(isObject(value), "The door must answer an object")
    return value
}

/** The calls of one member of a workspace to the one door of the screens, answered as the screens read them. */
export interface DoorCalls {
    /** The data a read answers: an object, or null for a read of nothing. */
    readonly data: (userId: string, name: string, payload?: DoorPayload) => Promise<unknown>
    /** The data a read answers, which must be an object. */
    readonly read: (userId: string, name: string, payload?: DoorPayload) => Promise<DoorObject>
    /** What an action answered. */
    readonly act: (userId: string, name: string, payload: DoorPayload) => Promise<DoorObject>
}

/** The calls to the door of one workspace, over the services of the world. */
export const doorCallsOf = (world: LiteWorld, workspaceId: string): DoorCalls => {
    const call = (name: string, payload: DoorPayload) => ({ workspaceId, name, payload: JSON.stringify(payload) })
    const data: DoorCalls["data"] = async (userId, name, payload = {}) =>
        jsonOf((await world.resolve(WorkbenchDoorService).read(userId, call(name, payload))).data)
    return {
        data,
        read: async (userId, name, payload = {}) => objectOf(await data(userId, name, payload)),
        act: async (userId, name, payload) =>
            objectOf(jsonOf((await world.resolve(WorkbenchDoorService).act(userId, call(name, payload))).data)),
    }
}

/** The ids of the rows of a page a list read answered. */
export const idsOfPage = (page: DoorObject): ReadonlyArray<string> => {
    const rows = page["rows"]
    assert(Array.isArray(rows), "A page must hold rows")
    return rows.map((row: unknown) => {
        assert(isObject(row) && typeof row["id"] === "string", "A row must carry its id")
        return row["id"]
    })
}

/** Registers the Sales executors with the graph node registry: the world compiles the app without starting it, so they register themselves here, as they do at start. */
export const registerSalesEffects = (world: LiteWorld): void => {
    world.resolve(LeadEffectsService).onModuleInit()
    world.resolve(OrderEffectsService).onModuleInit()
}
