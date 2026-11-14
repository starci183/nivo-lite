import { builder } from "@starci/jest-preset"
import type { ConnectionRecord } from "@modules/domain/connections"

/** An open API account of the workspace, as the bindings read answers its record. */
export const connectionRecordOf: (overrides?: Partial<ConnectionRecord>) => ConnectionRecord =
    builder<ConnectionRecord>({
        id: "8f8f2c1e-0000-4000-8000-00000000c001",
        workspaceId: "7b0f0a52-1111-4222-8333-444455556666",
        provider: "openapi",
        name: "API",
        meta: {},
        status: "connected",
        lastError: null,
        environment: "live",
        sandbox: false,
        isDefault: false,
        lastEventAt: null,
        firstEvent: null,
        createdBy: null,
        createdAt: "2026-11-03T00:00:00.000Z",
    })
