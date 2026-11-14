import { builder } from "@starci/jest-preset"
import type { ConnectionStatusFacts } from "@modules/domain/connections"

/** An open API account of the workspace, as the bindings read answers it. */
export const connectionStatusOf: (overrides?: Partial<ConnectionStatusFacts>) => ConnectionStatusFacts =
    builder<ConnectionStatusFacts>({
        id: "8f8f2c1e-0000-4000-8000-00000000c001",
        provider: "openapi",
        name: "API",
        status: "connected",
        createdAt: new Date("2026-11-01T00:00:00.000Z"),
        botUsername: null,
        accountMasked: null,
        lastError: null,
        oaId: null,
        email: null,
    })
