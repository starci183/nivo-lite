import { Injectable } from "@nestjs/common"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import type { OptionalWorkspacePaymentAccount, WorkspacePaymentAccount } from "./channel-connections.contracts"
import { isAccountNumber } from "./money-provider.policy"

/** The bank feeds that name a bank account, in order of preference. */
const BANK_FEEDS = ["sepay", "casso"] as const

/** Newest first. */
const byNewest = (left: ConnectionRecord, right: ConnectionRecord): number =>
    right.createdAt.localeCompare(left.createdAt)

/** The account a feed stores, or null when it lacks a full account number or a bank code. */
const accountOfFeed = (feed: ConnectionRecord): WorkspacePaymentAccount | null => {
    const accountNumber = feed.meta.account_number ?? ""
    const bankCode = feed.meta.bank_code ?? ""
    if (!isAccountNumber(accountNumber) || bankCode === "") return null
    const holder = feed.meta.account_holder ?? ""
    return { accountNumber, bankCode, holder: holder === "" ? null : holder, provider: feed.provider }
}

@Injectable()
/** Reads the bank account a workspace is paid into from its own bank feeds; it never logs the account number. */
export class WorkspacePaymentAccountService {
    constructor(private readonly connections: ConnectionsService) {}

    /**
     * The account of the workspace's live (not disconnected) bank feed that stores a full account number: SePay first, then
     * Casso, the most recent feed of a provider first. Null when no feed has one (feeds made before the full number was stored).
     */
    async accountOf(workspaceId: string): Promise<OptionalWorkspacePaymentAccount> {
        const byProvider = await Promise.all(
            BANK_FEEDS.map((provider) =>
                this.connections.listByProvider(workspaceId, provider, { includeDisconnected: false }),
            ),
        )
        for (const feeds of byProvider) {
            const live = feeds.filter((feed) => feed.status !== "disconnected").sort(byNewest)
            for (const feed of live) {
                const account = accountOfFeed(feed)
                if (account !== null) return account
            }
        }
        return null
    }
}
