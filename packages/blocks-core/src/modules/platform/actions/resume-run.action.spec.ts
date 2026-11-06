import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import type { MemberDirectory, ParkedRuns, RightsDirectory, RunStanding } from "../platform.types"
import { membersPort, parkedRunsPort, rightsPort } from "../ports"
import { resumeRunAction } from "./resume-run.action"

const contextOf = (memberId: string | null): RunContext => ({
    workspaceId: "w1",
    memberId,
    now: new Date("2026-11-04T11:30:00.000Z"),
    timeZone: "Asia/Ho_Chi_Minh",
})

interface World {
    readonly standing: RunStanding | null
    readonly resumes?: boolean
    readonly manager?: boolean
    readonly holders?: ReadonlyArray<string>
}

const execute = (world: World, raw: unknown, memberId: string | null = "m1") => {
    const resumed: Array<string> = []
    const runs: ParkedRuns = {
        list: () => Promise.resolve({ total: 0, rows: [] }),
        find: () => Promise.resolve(world.standing),
        resume: (id) => {
            resumed.push(id)
            return Promise.resolve(world.resumes ?? true)
        },
    }
    const members: MemberDirectory = {
        get: (id) => Promise.resolve({ displayName: id, isManager: world.manager ?? false }),
    }
    const rights: RightsDirectory = {
        holds: (_member, permission) => Promise.resolve((world.holders ?? []).includes(permission)),
    }
    const provider: PortProvider = {
        implementationOf: (port) => {
            if (port.id === parkedRunsPort.id) return runs
            if (port.id === membersPort.id) return members
            return port.id === rightsPort.id ? rights : undefined
        },
    }
    const result: Promise<ActionResult> =
        resumeRunAction.execute?.(provider, raw, contextOf(memberId)) ??
        Promise.resolve({ ok: false, reason: "failed", message: { key: "x" } })
    return { resumed, result }
}

const PARKED: RunStanding = { module: "sales", parked: true }
const refused = (key: string): ActionResult => ({ ok: false, reason: "refused", message: { key } })

describe("platform.resume-run", () => {
    it("resumes a parked run for a manager", async () => {
        const { resumed, result } = execute({ standing: PARKED, manager: true }, { id: "run-1" })
        await expect(result).resolves.toEqual({ ok: true })
        expect(resumed).toEqual(["run-1"])
    })

    it("resumes it for a member who holds the manage permission of the run's module", async () => {
        await expect(execute({ standing: PARKED, holders: ["sales.manage"] }, { id: "run-1" }).result).resolves.toEqual(
            { ok: true },
        )
    })

    it("refuses a member who is neither, and an actor that is no member", async () => {
        const staff = execute({ standing: PARKED, holders: ["chatbot.manage"] }, { id: "run-1" })
        await expect(staff.result).resolves.toEqual(refused("refusal_forbidden"))
        expect(staff.resumed).toEqual([])
        await expect(execute({ standing: PARKED }, { id: "run-1" }, null).result).resolves.toEqual(
            refused("refusal_forbidden"),
        )
    })

    it("refuses a run that is not there, and a run that is not parked", async () => {
        await expect(execute({ standing: null, manager: true }, { id: "x" }).result).resolves.toEqual(
            refused("refusal_missing"),
        )
        const running = execute({ standing: { module: "sales", parked: false }, manager: true }, { id: "run-1" })
        await expect(running.result).resolves.toEqual(refused("refusal_not_parked"))
        expect(running.resumed).toEqual([])
    })

    it("refuses a run the engine found no longer parked, and an input it does not declare", async () => {
        await expect(
            execute({ standing: PARKED, manager: true, resumes: false }, { id: "run-1" }).result,
        ).resolves.toEqual(refused("refusal_not_parked"))
        await expect(execute({ standing: PARKED, manager: true }, {}).result).resolves.toMatchObject({
            ok: false,
            reason: "invalid",
        })
    })

    it("is asked under the platform view permission and refreshes the parked runs", () => {
        expect(resumeRunAction.permission).toBe("platform.view")
        expect(resumeRunAction.refreshes).toEqual(["platform.parked-runs"])
    })
})
