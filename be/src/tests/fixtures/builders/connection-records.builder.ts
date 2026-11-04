import type { ConnectionRecord } from "@modules/domain/connections"

/** A stored connection (SePay by default), with the selected fields overridden for a case. */
export const connectionRecord = (overrides: Partial<ConnectionRecord> = {}): ConnectionRecord => ({
    id: "c-1",
    workspaceId: "ws-1",
    provider: "sepay",
    name: "SePay - VCB",
    meta: {},
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "owner-1",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
})
