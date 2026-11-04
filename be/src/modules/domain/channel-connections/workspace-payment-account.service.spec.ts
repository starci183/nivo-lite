import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { FeedAccountFacts } from "@modules/domain/connections"
import { WorkspacePaymentAccountService } from "./workspace-payment-account.service"

const feed = (overrides: Partial<FeedAccountFacts> = {}): FeedAccountFacts => ({
    id: "c1",
    provider: "sepay",
    status: "connected",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    accountNumber: "0123456789",
    bankCode: "VCB",
    accountHolder: "LAN",
    ...overrides,
})

const build = async (byProvider: Readonly<Record<string, ReadonlyArray<FeedAccountFacts>>>) => {
    const bindings = mock<ConnectionBindingsReadService>()
    bindings.feedAccountsOf.mockImplementation((_workspaceId, provider) =>
        Promise.resolve([...(byProvider[provider] ?? [])]),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [WorkspacePaymentAccountService, { provide: ConnectionBindingsReadService, useValue: bindings }],
    }).compile()
    return { service: moduleRef.get(WorkspacePaymentAccountService), bindings }
}

describe("WorkspacePaymentAccountService accountOf", () => {
    it("answers the full account of the workspace's SePay feed, reading the live feeds of each provider", async () => {
        const { service, bindings } = await build({ sepay: [feed()] })

        await expect(service.accountOf("ws-1")).resolves.toEqual({
            accountNumber: "0123456789",
            bankCode: "VCB",
            holder: "LAN",
            provider: "sepay",
            connectionId: "c1",
        })
        expect(bindings.feedAccountsOf).toHaveBeenCalledWith("ws-1", "sepay", 20)
        expect(bindings.feedAccountsOf).toHaveBeenCalledWith("ws-1", "casso", 20)
    })

    it("prefers SePay over Casso, and the first feed the read answers, which is the newest", async () => {
        const { service } = await build({
            casso: [feed({ id: "c2", provider: "casso" })],
            sepay: [feed({ id: "new", bankCode: "TCB", accountNumber: "999888777" }), feed({ id: "old" })],
        })

        await expect(service.accountOf("ws-1")).resolves.toMatchObject({
            provider: "sepay",
            connectionId: "new",
            bankCode: "TCB",
        })
    })

    it("skips feeds without a full account number or a bank code and falls back to Casso", async () => {
        const { service } = await build({
            sepay: [feed({ id: "legacy", accountNumber: null }), feed({ id: "no-bank", bankCode: null })],
            casso: [
                feed({
                    id: "casso",
                    provider: "casso",
                    bankCode: "ACB",
                    accountNumber: "55556666",
                    accountHolder: null,
                }),
            ],
        })

        await expect(service.accountOf("ws-1")).resolves.toEqual({
            accountNumber: "55556666",
            bankCode: "ACB",
            holder: null,
            provider: "casso",
            connectionId: "casso",
        })
    })

    it("answers null when no feed stores a full account number", async () => {
        const { service } = await build({ sepay: [feed({ accountNumber: "12ab" })] })

        await expect(service.accountOf("ws-1")).resolves.toBeNull()
    })
})
