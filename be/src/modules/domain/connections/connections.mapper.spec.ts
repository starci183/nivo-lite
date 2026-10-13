import { toConnectionRecord } from "./connections.mapper"
import type { ConnectionSelectRow } from "./persistence/connections.rows"

const row: ConnectionSelectRow = {
    id: "c1",
    workspace_id: "w1",
    provider: "sepay",
    name: "Bank",
    public_meta: { bank_code: "VCB" },
    status: "connected",
    last_error: null,
    environment: "test",
    is_default: true,
    last_event_at: "2026-10-12T01:00:00Z",
    first_event: { amount: 5, content: "hi", at: "2026-10-12T01:00:00Z" },
    created_by: "u1",
    created_at: "2026-10-01T00:00:00Z",
}

describe("toConnectionRecord", () => {
    it("maps every column to its camelCase field", () => {
        expect(toConnectionRecord(row)).toEqual({
            id: "c1",
            workspaceId: "w1",
            provider: "sepay",
            name: "Bank",
            meta: { bank_code: "VCB" },
            status: "connected",
            lastError: null,
            environment: "test",
            isDefault: true,
            lastEventAt: "2026-10-12T01:00:00Z",
            firstEvent: { amount: 5, content: "hi", at: "2026-10-12T01:00:00Z" },
            createdBy: "u1",
            createdAt: "2026-10-01T00:00:00Z",
        })
    })

    it("falls back to empty meta, live and not default for odd stored values", () => {
        const odd: ConnectionSelectRow = { ...row, public_meta: [], environment: null, is_default: null }

        expect(toConnectionRecord(odd)).toMatchObject({ meta: {}, environment: "live", isDefault: false })
        expect(toConnectionRecord({ ...odd, public_meta: null })).toMatchObject({ meta: {} })
    })
})
