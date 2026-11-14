import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { AccountDataReadService } from "@modules/domain/account-data"
import { accountStateOf, type AccountRecord } from "./account-info.policy"
import { AccountInfoService } from "./account-info.service"

type StoredRecord = NonNullable<Awaited<ReturnType<ConnectionBindingsReadService["recordOf"]>>>

const ACCOUNT: AccountRecord = {
    id: "c-1",
    status: "connected",
    lastError: null,
    lastEventAt: "2026-11-12T07:00:00.000Z",
    meta: { account_masked: "**** 9999", summary: "12 mails" },
}

/** A stored connection of a provider, as the bindings read answers it. */
const stored = (provider: StoredRecord["provider"]): StoredRecord => ({
    ...ACCOUNT,
    workspaceId: "ws-1",
    provider,
    name: "Account",
    status: "connected",
    environment: "live",
    isDefault: false,
    firstEvent: null,
    createdBy: null,
    createdAt: "2026-11-01T00:00:00.000Z",
})

const build = async () => {
    const bindings = mock<ConnectionBindingsReadService>()
    const accountData = mock<AccountDataReadService>()
    accountData.statsOf.mockResolvedValue({
        types: [
            { type: "sepay.delivery", purpose: "bank.event", rows: 9, newestAt: null },
            { type: "sepay.transaction", purpose: "bank.transaction", rows: 7, newestAt: null },
        ],
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountInfoService,
            { provide: ConnectionBindingsReadService, useValue: bindings },
            { provide: AccountDataReadService, useValue: accountData },
        ],
    }).compile()
    const [bank, mailbox] = moduleRef.get(AccountInfoService).providers()
    return { bindings, bank, mailbox, accountData }
}

describe("AccountInfoService", () => {
    it("draws a bank feed and a mailbox from what their connection stores, as typed figures", async () => {
        const { bindings, bank, mailbox, accountData } = await build()
        bindings.recordOf.mockResolvedValueOnce(stored("sepay")).mockResolvedValueOnce(stored("imap"))

        const feed = await bank?.infoOf?.("ws-1", "c-1")
        const box = await mailbox?.infoOf?.("ws-1", "c-1")

        expect([bank?.provider, mailbox?.provider]).toEqual(["sepay", "imap"])
        expect(feed).toMatchObject({ connectionId: "c-1", state: "ok" })
        expect(feed?.figures.map((figure) => [figure.key, figure.value, figure.kind])).toEqual([
            ["account", "**** 9999", "text"],
            ["transactions_received", 7, "count"],
            ["last_received", "2026-11-12T07:00:00.000Z", "time"],
        ])
        expect(feed?.asOf).toBe("2026-11-12T07:00:00.000Z")
        // One stats read of the account, no sum and no judgement of the rows.
        expect(accountData.statsOf.mock.calls).toEqual([["c-1"]])
        expect(box?.figures.map((figure) => [figure.key, figure.value])).toEqual([
            ["last_sync", "12 mails"],
            ["last_received", "2026-11-12T07:00:00.000Z"],
        ])
        expect(bindings.recordOf).toHaveBeenCalledWith("ws-1", "c-1")
    })

    it("draws a dash for the count when the store cannot give it, and still answers the account", async () => {
        const { bindings, bank, accountData } = await build()
        bindings.recordOf.mockResolvedValueOnce(stored("sepay"))
        accountData.statsOf.mockRejectedValue(new Error("down"))

        const feed = await bank?.infoOf?.("ws-1", "c-1")

        expect(feed?.state).toBe("ok")
        expect(feed?.figures.filter((figure) => figure.kind === "count").map((figure) => figure.value)).toEqual([null])
    })

    it("knows no account of another provider or another workspace, and offers no named read yet", async () => {
        const { bindings, bank } = await build()
        bindings.recordOf.mockResolvedValueOnce(stored("imap")).mockResolvedValueOnce(null)

        await expect(bank?.infoOf?.("ws-1", "c-1")).resolves.toBeNull()
        await expect(bank?.infoOf?.("ws-2", "c-1")).resolves.toBeNull()
        await expect(bank?.readsOf("ws-1")).resolves.toEqual([])
        await expect(bank?.read({ workspaceId: "ws-1", memberId: "m" }, "transactions", {})).rejects.toMatchObject({
            params: { reason: "not_selected" },
        })
    })

    it("says when an account needs the owner or is off", () => {
        expect(accountStateOf({ ...ACCOUNT, lastError: "refused" })).toBe("attention")
        expect(accountStateOf({ ...ACCOUNT, status: "pending" })).toBe("attention")
        expect(accountStateOf({ ...ACCOUNT, status: "disconnected" })).toBe("off")
    })
})
