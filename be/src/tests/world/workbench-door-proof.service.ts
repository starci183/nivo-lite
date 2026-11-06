import assert from "node:assert/strict"
import type { DataSource } from "typeorm"
import { WorkbenchDoorService } from "@modules/domain/workbench-door"
import { jobsEntities } from "@modules/platform/jobs"
import { persistWorkspace } from "../fixtures/builders/accounting-scene.builder"
import type { SceneWorkspace } from "../fixtures/builders/accounting-scene.builder"
import type { LiteWorld } from "./lite-world.service"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"
import { openOwnerConnection } from "./workbench-door-proof.module"
import { WAITING_ON_LOCK } from "./workbench-door-proof.sql"

const JobOutboxEntity: (typeof jobsEntities)[1] = jobsEntities[1]

/** The most deliveries one proof reads back from the outbox. */
const DELIVERIES_MAX = 100

/** How many times a proof looks for a blocked statement, and how long it waits between looks. */
const BLOCK_POLLS = 200
const BLOCK_POLL_MS = 25

/** One delivery the outbox holds: the declared job it runs, and the row the processor claims. */
export interface JobDelivery {
    /** The id of the outbox row. */
    readonly id: string
    /** The declared job name. */
    readonly job: string
    /** The payload the producer wrote. */
    readonly payload: object
}

/** What a suite does with the workbench door, as the owner of a workspace, besides the engine ports of the world. */
export interface DoorProof {
    /** Writes a user and the workspace they own as the database owner, and removes both when the suite ends. */
    persistWorkspace(scene: SceneWorkspace): Promise<void>
    /** Runs a read through the door as the owner of the workspace; answers its data. */
    read(scene: SceneWorkspace, name: string, variables?: object): Promise<unknown>
    /** Runs an action through the door as the owner of the workspace; answers its result. */
    act(scene: SceneWorkspace, name: string, input: object): Promise<unknown>
    /** The deliveries the workspace holds in the outbox, oldest first. */
    deliveries(workspaceId: string): Promise<ReadonlyArray<JobDelivery>>
    /** Resolves when a statement of another connection is blocked behind a transaction the proof holds open. */
    untilBlocked(): Promise<void>
}

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** The text the door answers, as the value it carries. */
const answerOf = (text: string): unknown => {
    try {
        const parsed: unknown = JSON.parse(text)
        return parsed
    } catch (cause) {
        throw new TestWorldError({ code: TestWorldErrorCode.AnswerMalformed, cause })
    }
}

const jobNameOf = (payload: object): string => {
    const named: unknown = Object.getOwnPropertyDescriptor(payload, "job")?.value
    assert(typeof named === "string", "A delivery of the module-jobs queue names its job")
    return named
}

/** Opens the owner connection with the suite and closes it after; the door is the world's. */
export const useDoorProof = (world: LiteWorld): DoorProof => {
    let owner: DataSource | undefined
    beforeAll(async () => {
        owner = await openOwnerConnection()
    })
    afterAll(async () => {
        await owner?.destroy()
    })
    const connection = (): DataSource => {
        assert(owner?.isInitialized, "The owner connection must be open")
        return owner
    }
    const waiting = async (): Promise<boolean> => {
        const [row] = await connection().manager.query<Array<{ waiting: number }>>(WAITING_ON_LOCK, [])
        return row !== undefined && row.waiting > 0
    }
    const blockedWithin = async (polls: number): Promise<void> => {
        if (polls <= 0 || (await waiting())) return
        await pause(BLOCK_POLL_MS)
        await blockedWithin(polls - 1)
    }
    return {
        persistWorkspace: (scene) => persistWorkspace(connection().manager, scene, (work) => world.cleanup(work)),
        read: async (scene, name, variables = {}) => {
            const answer = await world.resolve(WorkbenchDoorService).read(scene.userId, {
                workspaceId: scene.workspaceId,
                name,
                payload: JSON.stringify(variables),
                locale: "vi",
            })
            return answerOf(answer.data)
        },
        act: async (scene, name, input) => {
            const answer = await world.resolve(WorkbenchDoorService).act(scene.userId, {
                workspaceId: scene.workspaceId,
                name,
                payload: JSON.stringify(input),
                locale: "vi",
            })
            return answerOf(answer.data)
        },
        deliveries: async (workspaceId) => {
            const rows = await connection().manager.find(JobOutboxEntity, {
                where: { workspaceId },
                order: { createdAt: "ASC" },
                take: DELIVERIES_MAX,
            })
            return rows.map((row) => ({ id: row.id, job: jobNameOf(row.payload), payload: row.payload }))
        },
        untilBlocked: () => blockedWithin(BLOCK_POLLS),
    }
}

/** The rows of a list read, as records of fields. */
export const rowsOf = (list: unknown): ReadonlyArray<Readonly<Record<string, unknown>>> => {
    if (typeof list !== "object" || list === null || !("rows" in list) || !Array.isArray(list.rows)) return []
    const rows: ReadonlyArray<unknown> = list.rows
    return rows.flatMap((row) => (typeof row === "object" && row !== null ? [{ ...row }] : []))
}

/** The names of the fields an action refused, from its result. */
export const refusedFieldsOf = (result: unknown): ReadonlyArray<string> => {
    if (typeof result !== "object" || result === null || !("fields" in result)) return []
    const { fields } = result
    return typeof fields === "object" && fields !== null ? Object.keys(fields) : []
}
