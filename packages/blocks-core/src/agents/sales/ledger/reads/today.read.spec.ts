import type { ReadDefinition, ReadRunResult } from "@nivo-lite/agent-sdk/block"
import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import { transactionOf } from "../rules/accounting.fixtures"
import type { TransactionRecord } from "../rules/accounting.types"
import { agentConnectionsPort, coreReadsPort } from "../../../../shared/platform/ports"
import { copyOf } from "../messages/copy"
import { memoryProvider, memoryWorld, putQuestion, putTransaction } from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { ownerQueueRead } from "./owner-queue.read"
import { todayRead } from "./today.read"

const CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: "m1",
    now: new Date("2026-11-04T11:30:00.000Z"),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
}

const INSTALLATION = "00000000-0000-4000-8000-000000000001"
const AGENT = "00000000-0000-4000-8000-000000000002"

const BANK = {
    manageLabel: "",
    manageHref: "",
    rows: [
        {
            id: "k1",
            name: "SePay",
            description: "",
            statusLabel: "",
            statusTone: "success" as const,
            accessLabel: "",
            provider: "sepay",
            access: "auto",
            isGranted: true,
        },
    ],
}

/** The memory provider with the ports of the agent of the installation, or of none. */
const providerOf = (world: MemoryWorld, hasAgent: boolean): PortProvider => {
    const base = memoryProvider(world)
    return {
        implementationOf: (port) => {
            if (port.id === coreReadsPort.id) return { agentOf: () => Promise.resolve(hasAgent ? AGENT : null) }
            if (port.id === agentConnectionsPort.id) return { of: () => Promise.resolve(BANK) }
            return base.implementationOf(port)
        },
    }
}

const run = (
    read: ReadDefinition,
    world: MemoryWorld,
    context: RunContext = CONTEXT,
    hasAgent = true,
): Promise<ReadRunResult> =>
    read.execute?.(providerOf(world, hasAgent), read === todayRead ? {} : { installation: INSTALLATION }, context) ??
    Promise.resolve({ ok: false, problems: [] })

const id = (n: number): string => `00000000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`

const payment = (n: number, over: Partial<TransactionRecord>): TransactionRecord =>
    transactionOf({ id: id(n), occurredAt: "2026-11-04T04:00:00.000Z", ...over })

const worldOf = (): MemoryWorld => {
    const world = memoryWorld()
    putTransaction(world, payment(1, { amountVnd: 250_000, status: "matched" }))
    putTransaction(world, payment(2, { amountVnd: 1_200_000, status: "unmatched" }))
    putTransaction(
        world,
        payment(3, { amountVnd: 900_000, status: "unmatched", occurredAt: "2026-11-02T04:00:00.000Z" }),
    )
    putTransaction(world, payment(4, { amountVnd: 70_000, direction: "debit", status: "matched" }))
    putQuestion(world, id(9), { text: "How much is order 1088?", source: "#1088" }, "2026-11-04T01:00:00.000Z")
    return world
}

describe("the accounting.today read", () => {
    it("adds up the money received today, the matched and unmatched payments and what waits for the owner", async () => {
        const result = await run(todayRead, worldOf())
        expect(result).toMatchObject({
            ok: true,
            data: { receivedVnd: 1_450_000, matchedCount: 1, unmatchedCount: 1, waitingCount: 2 },
        })
    })

    it("is zero on a day with no payment, and read with the view permission", async () => {
        await expect(run(todayRead, memoryWorld())).resolves.toMatchObject({
            ok: true,
            data: { receivedVnd: 0, matchedCount: 0, unmatchedCount: 0, waitingCount: 0 },
        })
        expect(todayRead.permission).toBe("sales.view")
    })
})

describe("the accounting.owner-queue read", () => {
    it("lists the unmatched payments of the month and the open questions in the words of the viewer, counted in all", async () => {
        const result = await run(ownerQueueRead, worldOf())
        expect(result).toMatchObject({ ok: true, data: { count: "3" } })
        expect(result.ok && result.data).toHaveProperty("rows.0.badges.0.label", copyOf("queue_unmatched", "vi"))
        expect(result.ok && result.data).toHaveProperty("rows.2.badges.0.label", copyOf("queue_question", "vi"))
    })

    it("answers in English for an English viewer", async () => {
        const result = await run(ownerQueueRead, worldOf(), { ...CONTEXT, locale: "en" })
        expect(result.ok && JSON.stringify(result.data)).toContain("Needs an answer")
    })

    it("leads each payment with the logo of the connection the agent reads, none without an agent", async () => {
        const led = await run(ownerQueueRead, worldOf())
        expect(led.ok && led.data).toHaveProperty("rows.0.logo", "/logos/providers/sepay.png")
        const bare = await run(ownerQueueRead, worldOf(), CONTEXT, false)
        expect(bare.ok && bare.data).not.toHaveProperty("rows.0.logo")
    })

    it("is empty when nothing waits", async () => {
        await expect(run(ownerQueueRead, memoryWorld())).resolves.toMatchObject({
            ok: true,
            data: { count: null, more: null, rows: [] },
        })
    })
})
