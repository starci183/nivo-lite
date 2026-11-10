import { Injectable } from "@nestjs/common"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { FeedAccountFacts } from "@modules/domain/connections"
import type { OptionalWorkspacePaymentAccount, WorkspacePaymentAccount } from "./channel-connections.contracts"
import { isAccountNumber } from "./money-provider.policy"

/** The bank feeds that name a bank account, in order of preference. */
const BANK_FEEDS = ["sepay", "casso"] as const

/** The most feeds of one provider read for an account. */
const FEEDS_MAX = 20

/** The account a feed stores, or null when it lacks a full account number or a bank code. */
const accountOfFeed = (feed: FeedAccountFacts): WorkspacePaymentAccount | null => {
    const { accountNumber, bankCode } = feed
    if (accountNumber === null || !isAccountNumber(accountNumber) || bankCode === null) return null
    return {
        accountNumber,
        bankCode,
        holder: feed.accountHolder,
        provider: feed.provider,
        connectionId: feed.id,
    }
}

@Injectable()
/** Reads the bank account a workspace is paid into from its own bank feeds; it never logs the account number. */
export class WorkspacePaymentAccountService {
    constructor(private readonly connections: ConnectionBindingsReadService) {}

    /**
     * The account of the workspace's live (not disconnected) bank feed that stores a full account number: SePay first, then
     * Casso, the most recent feed of a provider first. Null when no feed has one (feeds made before the full number was stored).
     */
    async accountOf(workspaceId: string): Promise<OptionalWorkspacePaymentAccount> {
        const byProvider = await Promise.all(
            BANK_FEEDS.map((provider) => this.connections.feedAccountsOf(workspaceId, provider, FEEDS_MAX)),
        )
        for (const feeds of byProvider) {
            for (const feed of feeds) {
                const account = accountOfFeed(feed)
                if (account !== null) return account
            }
        }
        return null
    }

    /**
     * The account of one named bank feed (the shop's default receiving account, as the gateway judged it): null when that feed is not
     * live or stores no full account number. Never falls back to another feed: the shop chose which account takes the money.
     */
    async accountOfConnection(workspaceId: string, connectionId: string): Promise<OptionalWorkspacePaymentAccount> {
        const byProvider = await Promise.all(
            BANK_FEEDS.map((provider) => this.connections.feedAccountsOf(workspaceId, provider, FEEDS_MAX)),
        )
        const feed = byProvider.flat().find((one) => one.id === connectionId)
        return feed === undefined ? null : accountOfFeed(feed)
    }
}
