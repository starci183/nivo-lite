import { mockEntityManager } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { DoorPressesService, pressOfRow } from "./door-presses.service"

const AT = new Date("2026-11-11T02:00:00.000Z")

const row = {
    door: "care.opt_out",
    subject: "lead-1",
    member_id: "member-1",
    outcome: "set",
    detail: { optOut: true, memberName: "Owner Lan" },
    pressed_at: AT,
}

const build = (rows: ReadonlyArray<unknown> = []) => {
    const em = mockEntityManager()
    const query = jest.fn().mockResolvedValue(rows)
    Object.assign(em, { query })
    return { service: new DoorPressesService(em as unknown as EntityManager), query }
}

/** The migration that declares the table and the two indexes its reads go by. */
const MIGRATION = readFileSync(
    join(__dirname, "../../../../../db/migrations/20261112013600_agent-door-presses.sql"),
    "utf8",
)

describe("DoorPressesService", () => {
    it("writes one press with who pressed, their name, what and what it came to", async () => {
        const { service, query } = build()

        await service.record({
            workspaceId: "ws-1",
            door: "schedule.run_now",
            subject: "task:t1:1",
            memberId: "member-1",
            memberName: "Owner Lan",
            outcome: "ran",
            detail: { kind: "task" },
        })

        expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO public.agent_door_presses"), [
            "ws-1",
            "schedule.run_now",
            "task:t1:1",
            "member-1",
            "ran",
            JSON.stringify({ kind: "task", memberName: "Owner Lan" }),
        ])
    })

    it("reads the last press of a subject and the newest of a door, each by the order of one of the table's indexes", async () => {
        const { service, query } = build([row])

        await expect(service.latest("ws-1", "care.opt_out", "lead-1")).resolves.toEqual({
            door: "care.opt_out",
            subject: "lead-1",
            memberId: "member-1",
            memberName: "Owner Lan",
            outcome: "set",
            at: AT,
        })
        await service.recent("ws-1", "schedule.run_now", 5000)

        const [latestSql, latestArgs] = query.mock.calls[0] ?? []
        const [recentSql, recentArgs] = query.mock.calls[1] ?? []
        expect(latestSql).toContain("WHERE workspace_id = $1 AND door = $2 AND subject = $3 ORDER BY pressed_at DESC LIMIT 1")
        expect(recentSql).toContain("WHERE workspace_id = $1 AND door = $2 ORDER BY pressed_at DESC LIMIT $3")
        expect(latestArgs).toEqual(["ws-1", "care.opt_out", "lead-1"])
        expect(recentArgs).toEqual(["ws-1", "schedule.run_now", 200])
        expect(MIGRATION).toContain("USING btree (workspace_id, door, subject, pressed_at DESC)")
        expect(MIGRATION).toContain("USING btree (workspace_id, door, pressed_at DESC)")
    })

    it("skips a row that is not a press", () => {
        expect(pressOfRow({ ...row, door: "other" })).toBeNull()
        expect(pressOfRow({ ...row, pressed_at: "not a date" })).toBeNull()
        expect(pressOfRow({ ...row, detail: {} })).toMatchObject({ memberName: "member-1" })
        expect(pressOfRow(null)).toBeNull()
    })
})
