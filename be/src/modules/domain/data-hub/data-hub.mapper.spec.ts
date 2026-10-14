import type { ConnectionRecord, SyncSchedule } from "@modules/domain/connections"
import { toDataConnection } from "./data-hub.mapper"

const record: ConnectionRecord = {
    id: "connection-1",
    workspaceId: "ws-1",
    provider: "csv_import",
    name: "Customers",
    meta: { summary: "2 d\u00f2ng" },
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "owner-1",
    createdAt: "2026-10-01T00:00:00.000Z",
}

const schedule: SyncSchedule = { everyMinutes: 60, lastSyncAt: "2026-10-14T00:00:00.000Z" }

describe("toDataConnection", () => {
    it("keeps the record, the checked provider and the schedule", () => {
        expect(toDataConnection(record, "csv_import", schedule)).toEqual({
            id: "connection-1",
            workspaceId: "ws-1",
            provider: "csv_import",
            name: "Customers",
            status: "connected",
            lastError: null,
            meta: { summary: "2 d\u00f2ng" },
            everyMinutes: 60,
            lastSyncAt: "2026-10-14T00:00:00.000Z",
        })
    })
})
