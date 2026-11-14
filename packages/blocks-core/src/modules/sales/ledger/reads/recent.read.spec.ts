import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import { transactionOf } from "../../../../rules/sales/ledger/accounting.fixtures"
import { agentConnectionsPort, coreReadsPort } from "../../../platform/ports"
import { memoryProvider, memoryWorld, putTransaction } from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { recentRead } from "./recent.read"

const CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: "m1",
    now: new Date("2026-11-04T11:30:00.000Z"),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
}

const INSTALLATION = "00000000-0000-4000-8000-000000000001"
const AGENT = "00000000-0000-4000-8000-000000000002"

const CONNECTIONS = {
    manageLabel: "",
    manageHref: "",
    rows: [
        {
            id: "k1",
            name: "MB 9999",
            description: "",
            statusLabel: "",
            statusTone: "success" as const,
            accessLabel: "",
            provider: "sepay",
            access: "auto",
            accountMasked: "****9999",
            isGranted: true,
        },
        {
            id: "k2",
            name: "VCB 1234",
            description: "",
            statusLabel: "",
            statusTone: "neutral" as const,
            accessLabel: "",
            provider: "sepay",
            isGranted: false,
        },
        { id: "k3", name: "Other", description: "", statusLabel: "", statusTone: "neutral" as const, accessLabel: "" },
    ],
}

const worldOf = (): MemoryWorld => {
    const world = memoryWorld()
    putTransaction(
        world,
        transactionOf({
            id: "00000000-0000-4000-8000-0000000004a1",
            status: "matched",
            occurredAt: "2026-11-04T07:32:00.000Z",
        }),
    )
    putTransaction(
        world,
        transactionOf({
            id: "00000000-0000-4000-8000-0000000004a2",
            direction: "debit",
            occurredAt: "2026-11-04T08:00:00.000Z",
        }),
    )
    return world
}

/** The memory provider with the platform ports a read of the agent needs on top of it. */
const providerOf = (world: MemoryWorld, hasAgent: boolean): PortProvider => {
    const base = memoryProvider(world)
    return {
        implementationOf: (port) => {
            if (port.id === coreReadsPort.id) return { agentOf: () => Promise.resolve(hasAgent ? AGENT : null) }
            if (port.id === agentConnectionsPort.id) return { of: () => Promise.resolve(CONNECTIONS) }
            return base.implementationOf(port)
        },
    }
}

describe("the accounting.recent read", () => {
    it("lists the payments received, each with the connection it came through and the level the agent holds", async () => {
        const result = await recentRead.execute?.(providerOf(worldOf(), true), { installation: INSTALLATION }, CONTEXT)
        expect(result).toMatchObject({ ok: true, data: { cursor: null } })
        expect(result?.ok && result.data).toHaveProperty("rows.0.connection", "MB 9999")
        expect(result?.ok && result.data).toHaveProperty("rows.0.level", "auto")
        expect(result?.ok && result.data).toHaveProperty("rows.0.status", "done")
        expect(result?.ok && result.data).not.toHaveProperty("rows.1")
    })

    it("names no connection for an installation with no agent", async () => {
        const result = await recentRead.execute?.(providerOf(worldOf(), false), { installation: INSTALLATION }, CONTEXT)
        expect(result?.ok && result.data).toHaveProperty("rows.0.connection", "")
    })

    it("answers in English for an English viewer, and is read with the view permission", async () => {
        const result = await recentRead.execute?.(
            providerOf(worldOf(), true),
            { installation: INSTALLATION },
            { ...CONTEXT, locale: "en" },
        )
        expect(result?.ok && JSON.stringify(result.data)).toContain("matched to an order")
        expect(recentRead.permission).toBe("sales.view")
    })
})
