import { toConnectionRecord } from "./connections.mapper"
import { ConnectionsErrorCode } from "./errors/connections.error"
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

    it.each([
        { provider: "unknown", status: "connected" },
        { provider: "sepay", status: "unknown" },
    ])("refuses stored provider $provider and status $status that cannot be mapped", ({ provider, status }) => {
        expect(() => toConnectionRecord({ ...row, provider, status })).toThrow(
            expect.objectContaining({ code: ConnectionsErrorCode.NotFound, params: { id: "c1" } }),
        )
    })

    it("keeps only string public facts and includes a readable first-event text", () => {
        const firstEvent = { amount: 0, content: "", at: "2026-10-12T01:00:00Z", text: "Hello" }
        const mapped = toConnectionRecord({
            ...row,
            public_meta: { bank_code: "VCB", count: 3, enabled: true, absent: null },
            first_event: firstEvent,
        })

        expect(mapped.meta).toEqual({ bank_code: "VCB" })
        expect(mapped.firstEvent).toEqual(firstEvent)
    })

    it.each([
        undefined,
        null,
        [],
        5,
        { amount: "5", content: "hi", at: "now" },
        { amount: 5, content: false, at: "now" },
        { amount: 5, content: "hi", at: 5 },
    ])("omits an invalid stored first event: %p", (firstEvent) => {
        expect(toConnectionRecord({ ...row, first_event: firstEvent }).firstEvent).toBeNull()
    })

    it("omits non-string optional event text", () => {
        expect(
            toConnectionRecord({ ...row, first_event: { amount: 5, content: "hi", at: "now", text: 9 } }).firstEvent,
        ).toEqual({ amount: 5, content: "hi", at: "now" })
    })
})
