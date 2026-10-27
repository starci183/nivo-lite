import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord, Provider } from "@modules/domain/connections"
import { WorkspacePaymentAccountService } from "./workspace-payment-account.service"

const feed = (overrides: Partial<ConnectionRecord> = {}): ConnectionRecord => ({
    id: "c1",
    workspaceId: "ws-1",
    provider: "sepay",
    name: "Bank",
    meta: {
        bank_code: "VCB",
        account_masked: "\u2022\u2022\u2022\u2022 6789",
        account_number: "0123456789",
        account_holder: "LAN",
    },
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

const build = async (byProvider: Partial<Record<Provider, ReadonlyArray<ConnectionRecord>>>) => {
    const connections = mock<ConnectionsService>()
    connections.listByProvider.mockImplementation((_workspaceId, provider) =>
        Promise.resolve(byProvider[provider] ?? []),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [WorkspacePaymentAccountService, { provide: ConnectionsService, useValue: connections }],
    }).compile()
    return { service: moduleRef.get(WorkspacePaymentAccountService), connections }
}

describe("WorkspacePaymentAccountService accountOf", () => {
    it("answers the full account of the workspace's SePay feed, asking only for live feeds of the workspace", async () => {
        const { service, connections } = await build({ sepay: [feed()] })

        await expect(service.accountOf("ws-1")).resolves.toEqual({
            accountNumber: "0123456789",
            bankCode: "VCB",
            holder: "LAN",
            provider: "sepay",
        })
        expect(connections.listByProvider).toHaveBeenCalledWith("ws-1", "sepay", { includeDisconnected: false })
        expect(connections.listByProvider).toHaveBeenCalledWith("ws-1", "casso", { includeDisconnected: false })
    })

    it("prefers SePay over a newer Casso feed", async () => {
        const { service } = await build({
            casso: [feed({ id: "c2", provider: "casso", createdAt: "2026-10-20T00:00:00.000Z" })],
            sepay: [feed({ meta: { bank_code: "MB", account_number: "111222333", account_holder: "LAN" } })],
        })

        await expect(service.accountOf("ws-1")).resolves.toMatchObject({ provider: "sepay", bankCode: "MB" })
    })

    it("takes the most recent feed of a provider", async () => {
        const older = feed({ id: "old", createdAt: "2026-09-01T00:00:00.000Z" })
        const newer = feed({
            id: "new",
            createdAt: "2026-10-05T00:00:00.000Z",
            meta: { bank_code: "TCB", account_number: "999888777", account_holder: "MAI" },
        })
        const { service } = await build({ sepay: [older, newer] })

        await expect(service.accountOf("ws-1")).resolves.toMatchObject({ accountNumber: "999888777", bankCode: "TCB" })
    })

    it("skips feeds without a full account number or a bank code and falls back to Casso", async () => {
        const { service } = await build({
            sepay: [
                feed({ id: "legacy", meta: { bank_code: "VCB", account_masked: "\u2022\u2022\u2022\u2022 6789" } }),
                feed({ id: "no-bank", meta: { account_number: "0123456789" } }),
                feed({ id: "gone", status: "disconnected", createdAt: "2026-10-30T00:00:00.000Z" }),
            ],
            casso: [feed({ id: "casso", provider: "casso", meta: { bank_code: "ACB", account_number: "55556666" } })],
        })

        await expect(service.accountOf("ws-1")).resolves.toEqual({
            accountNumber: "55556666",
            bankCode: "ACB",
            holder: null,
            provider: "casso",
        })
    })

    it("answers null when no feed stores a full account number", async () => {
        const { service } = await build({ sepay: [feed({ meta: { bank_code: "VCB", account_number: "12ab" } })] })

        await expect(service.accountOf("ws-1")).resolves.toBeNull()
    })
})
