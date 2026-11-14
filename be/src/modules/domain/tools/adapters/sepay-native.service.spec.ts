import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AccountDataReadService, type StoredRow } from "@modules/domain/account-data"
import { ConnectionBindingsReadService, type ConnectionRecord, type ConnectionStatusFacts } from "@modules/domain/connections"
import { summaryOf } from "../audit-mask.policy"
import { ToolsErrorCode } from "../errors/tools.error"
import { toolNameOf } from "../tool-name.policy"
import { SEPAY_MANIFEST, SepayNativeService } from "./sepay-native.service"

/** A raw `sepay.transaction` row of an account, as the bank feed's intake kept it. */
const rowOf = (id: string, direction: string, at: string, amount = 3600000): StoredRow => ({
    id,
    type: "sepay.transaction",
    typeVersion: 1,
    key: `k-${id}`,
    value: { transactionId: `s-${id}`, amount, direction, content: "HAKUEN F7K2Q9", payer: "NGUYEN VAN A", source: "webhook" },
    occurredAt: new Date(at),
    processedAt: null,
})

const ROWS: Readonly<Record<string, ReadonlyArray<StoredRow>>> = {
    "conn-1": [rowOf("tx-1", "credit", "2026-10-20T02:00:00.000Z"), rowOf("tx-2", "debit", "2026-10-20T01:00:00.000Z", 500000)],
    "conn-2": [rowOf("tx-3", "credit", "2026-10-21T02:00:00.000Z", 120000)],
}

const build = async () => {
    const rows = mock<AccountDataReadService>()
    rows.newest.mockImplementation((connectionId) => Promise.resolve([...(ROWS[connectionId] ?? [])]))
    rows.byId.mockImplementation((_type, id) => {
        const found = Object.entries(ROWS).flatMap(([connectionId, held]) =>
            held.filter((row) => row.id === id).map((row) => ({ ...row, connectionId, createdAt: "2026-10-20T02:00:00.000000Z" })),
        )
        return Promise.resolve(found[0] ?? null)
    })
    const connections = mock<ConnectionBindingsReadService>()
    connections.ofProvider.mockResolvedValue([{ id: "conn-1" }, { id: "conn-2" }] as Array<ConnectionStatusFacts>)
    connections.recordOf.mockImplementation((workspaceId, id) =>
        Promise.resolve(workspaceId === "ws-1" ? ({ id } as ConnectionRecord) : null),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            SepayNativeService,
            { provide: AccountDataReadService, useValue: rows },
            { provide: ConnectionBindingsReadService, useValue: connections },
        ],
    }).compile()
    return { sepay: moduleRef.get(SepayNativeService), rows, connections }
}

describe("SepayNativeService manifest", () => {
    it("declares the sepay manifest with the bank move filters only", async () => {
        const { sepay } = await build()

        expect(sepay.manifest).toBe(SEPAY_MANIFEST)
        expect(SEPAY_MANIFEST.tools.map((tool) => toolNameOf(SEPAY_MANIFEST, tool.name))).toEqual([
            "nivo.tool.payment.credit.list",
            "nivo.tool.payment.debit.list",
        ])
        for (const tool of SEPAY_MANIFEST.tools) {
            expect(tool.inputSchema).toMatchObject({
                properties: {
                    since: { type: "string", minLength: 20, maxLength: 40, format: "date-time" },
                    limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
                },
                additionalProperties: false,
            })
        }
    })
})

describe("SepayNativeService audit", () => {
    it("keeps the payer and the memo out of the summary the audit stores while the answer is unchanged", async () => {
        const { sepay } = await build()

        const answer = await sepay.invoke("ws-1", "credit.list", {})
        const summary = summaryOf(answer, SEPAY_MANIFEST.tools[0]?.secretFields)

        expect(answer).toMatchObject({ transactions: [{ payer: "NGUYEN VAN A", reference: "HAKUEN F7K2Q9" }, { id: "tx-1" }] })
        expect(summary).not.toContain("NGUYEN VAN A")
        expect(summary).toContain('"amountVnd":120000')
    })
})

describe("SepayNativeService lists", () => {
    it("answers the credits of every SePay account of the workspace as the raw rows hold them, newest first", async () => {
        const { sepay, connections } = await build()

        expect(await sepay.invoke("ws-1", "credit.list", {})).toEqual({
            transactions: [
                { id: "tx-3", amountVnd: 120000, reference: "HAKUEN F7K2Q9", payer: "NGUYEN VAN A", occurredAt: "2026-10-21T02:00:00.000Z" },
                { id: "tx-1", amountVnd: 3600000, reference: "HAKUEN F7K2Q9", payer: "NGUYEN VAN A", occurredAt: "2026-10-20T02:00:00.000Z" },
            ],
        })
        expect(connections.ofProvider).toHaveBeenCalledWith("ws-1", "sepay", 20)
    })

    it("answers the debits on the debit list, and keeps the moves since the instant and within the limit", async () => {
        const { sepay } = await build()

        expect(await sepay.invoke("ws-1", "debit.list", {})).toMatchObject({ transactions: [{ id: "tx-2", amountVnd: 500000 }] })
        expect(await sepay.invoke("ws-1", "credit.list", { since: "2026-10-21T00:00:00Z" })).toMatchObject({
            transactions: [{ id: "tx-3" }],
        })
        expect(await sepay.invoke("ws-1", "credit.list", { limit: 1 })).toMatchObject({ transactions: [{ id: "tx-3" }] })
    })

    it("answers the one credit a step names, only when it is a credit of the workspace's own account", async () => {
        const { sepay } = await build()

        expect(await sepay.invoke("ws-1", "credit.list", { transactionId: "tx-1" })).toMatchObject({ transactions: [{ id: "tx-1" }] })
        expect(await sepay.invoke("ws-1", "credit.list", { transactionId: "tx-2" })).toEqual({ transactions: [] })
        expect(await sepay.invoke("ws-2", "credit.list", { transactionId: "tx-1" })).toEqual({ transactions: [] })
        expect(await sepay.invoke("ws-1", "credit.list", { transactionId: "tx-9" })).toEqual({ transactions: [] })
    })
})

describe("SepayNativeService refusals", () => {
    it.each([
        ["a status filter", "credit.list", { status: "matched" }],
        ["a transactionId on the debit list", "debit.list", { transactionId: "tx-2" }],
        ["a limit above fifty", "credit.list", { limit: 51 }],
    ])("refuses %s as invalid arguments", async (_label, tool, args) => {
        const { sepay } = await build()

        await expect(sepay.invoke("ws-1", tool, args)).rejects.toMatchObject({ code: ToolsErrorCode.InvalidArguments })
    })

    it("refuses a tool the connector does not have, and every tool in an app with no account store", async () => {
        const { sepay } = await build()

        await expect(sepay.invoke("ws-1", "order.list", {})).rejects.toMatchObject({ code: ToolsErrorCode.UnknownTool })
        await expect(new SepayNativeService().invoke("ws-1", "credit.list", {})).rejects.toMatchObject({
            code: ToolsErrorCode.UnknownTool,
        })
    })
})
