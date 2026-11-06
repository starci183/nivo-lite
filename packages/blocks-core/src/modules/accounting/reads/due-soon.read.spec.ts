import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { providerOf } from "../accounting.doubles"
import { dueSoonRead } from "./due-soon.read"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date("2026-11-04T11:30:00.000Z") }

describe("the accounting.due-soon read", () => {
    it("lists the declarations that fall due within 30 days of now", async () => {
        const result = await dueSoonRead.execute?.(providerOf([]), {}, CONTEXT)
        expect(result).toMatchObject({ ok: true, data: { rows: [{ kind: "vat" }, { kind: "pit" }] } })
    })

    it("is read with the view permission", () => {
        expect(dueSoonRead.permission).toBe("accounting.view")
    })
})
