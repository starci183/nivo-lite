import type { EngineResult, EntityApi, RecordRow, WriteValues } from "@nivo-lite/agent-sdk/entity/port"
import { unprovided } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition, PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import { addCandidateAction, saveJobAction, updateCandidateAction } from "../../actions/hiring.actions"
import { CANDIDATES, JOBS } from "../../ports"
import { candidateRead, jobRead } from "../../reads/hiring.read"

const CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: "m1",
    now: new Date("2026-11-13T03:00:00.000Z"),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
}

const AT = "2026-11-13T03:00:00.000Z"

/** One record type held in memory: its port and its rows. */
interface MemoryTable {
    /** The port the module's code calls. */
    readonly api: EntityApi
    /** The rows by id. */
    readonly rows: Map<string, RecordRow>
}

/** One record type held in memory: get, insert and update, the only calls the hiring actions and reads make. */
const memoryTable = (prefix: string): MemoryTable => {
    const rows = new Map<string, RecordRow>()
    const write = (row: RecordRow): EngineResult => {
        rows.set(row.id, row)
        return { ok: true, row, version: row.version }
    }
    const api: EntityApi = {
        get: (id) => Promise.resolve(rows.get(id) ?? null),
        insert: (values: WriteValues) =>
            Promise.resolve(
                write({
                    id: `${prefix}${rows.size + 1}`,
                    workspaceId: "w1",
                    version: "1",
                    createdAt: AT,
                    updatedAt: AT,
                    data: values,
                }),
            ),
        update: (key, expected, values) => {
            const current = rows.get(key)
            if (current === undefined) return Promise.resolve({ ok: false, reason: "missing" })
            if (current.version !== expected) return Promise.resolve({ ok: false, reason: "stale" })
            return Promise.resolve(
                write({
                    ...current,
                    version: String(Number(current.version) + 1),
                    data: { ...current.data, ...values },
                }),
            )
        },
        list: jest.fn(),
        aggregate: jest.fn(),
        upsert: jest.fn(),
        ensure: jest.fn(),
        delete: jest.fn(),
        link: jest.fn(),
        unlink: jest.fn(),
    }
    return { api, rows }
}

const worldOf = () => {
    const jobs = memoryTable("j")
    const candidates = memoryTable("c")
    const provider: PortProvider = {
        implementationOf: (port: PortDefinition<unknown>): unknown => {
            if (port.id === JOBS.id) return jobs.api
            if (port.id === CANDIDATES.id) return candidates.api
            return unprovided(port)
        },
    }
    return { jobs, candidates, provider }
}

describe("the hiring actions and reads", () => {
    it("creates a job, adds a candidate to it at stage new, and reads the candidate with the job's title", async () => {
        const world = worldOf()
        const job = await saveJobAction.execute?.(
            world.provider,
            { title: "Barista", requirements: "1 year behind a bar" },
            CONTEXT,
        )
        expect(job).toEqual({ ok: true, data: { id: "j1" } })
        const added = await addCandidateAction.execute?.(
            world.provider,
            { id: "j1", name: "Tran Minh Anh", contact: "minhanh@example.com" },
            CONTEXT,
        )
        expect(added).toEqual({ ok: true, data: { id: "c1" } })
        expect(world.candidates.rows.get("c1")?.data).toMatchObject({ jobId: "j1", stage: "new", profile: "" })
        const read = await candidateRead.execute?.(world.provider, { id: "c1" }, CONTEXT)
        expect(read).toMatchObject({
            ok: true,
            data: { name: "Tran Minh Anh", jobTitle: "Barista", stage: "new" },
        })
    })

    it("changes a saved job and refuses a job the store does not hold", async () => {
        const world = worldOf()
        await saveJobAction.execute?.(world.provider, { title: "Barista" }, CONTEXT)
        expect(
            await saveJobAction.execute?.(world.provider, { id: "j1", title: "Barista", status: "closed" }, CONTEXT),
        ).toEqual({
            ok: true,
            data: { id: "j1" },
        })
        expect(await jobRead.execute?.(world.provider, { id: "j1" }, CONTEXT)).toMatchObject({
            ok: true,
            data: { status: "closed" },
        })
        expect(await saveJobAction.execute?.(world.provider, { id: "j9", title: "Barista" }, CONTEXT)).toMatchObject({
            ok: false,
            reason: "refused",
        })
        expect(await addCandidateAction.execute?.(world.provider, { id: "j9", name: "An" }, CONTEXT)).toMatchObject({
            ok: false,
            reason: "refused",
        })
    })

    it("moves a candidate to the stage a person chose and keeps the notes", async () => {
        const world = worldOf()
        await saveJobAction.execute?.(world.provider, { title: "Barista" }, CONTEXT)
        await addCandidateAction.execute?.(world.provider, { id: "j1", name: "An" }, CONTEXT)
        expect(
            await updateCandidateAction.execute?.(
                world.provider,
                { id: "c1", stage: "interview", notes: "Meet on Monday" },
                CONTEXT,
            ),
        ).toEqual({ ok: true, data: { id: "c1" } })
        expect(world.candidates.rows.get("c1")?.data).toMatchObject({ stage: "interview", notes: "Meet on Monday" })
        expect(
            await updateCandidateAction.execute?.(world.provider, { id: "c1", stage: "fired" }, CONTEXT),
        ).toMatchObject({
            ok: false,
        })
    })
})
