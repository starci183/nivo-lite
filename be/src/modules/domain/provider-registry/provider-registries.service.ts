import { Injectable } from "@nestjs/common"
import { ProviderRegistryService } from "./provider-registry.service"
import type {
    BankFeedPoller,
    BankTransactionsPort,
    FeedWebhookPort,
    LedgerPort,
    MessageInboxPoller,
    PaymentInstructionPort,
} from "./provider-ports.contracts"

@Injectable()
/** The bank providers whose transactions can be read back to catch what the webhook never delivered. */
export class BankFeedPollerRegistryService extends ProviderRegistryService<BankFeedPoller> {}

@Injectable()
/** The bank providers that build the payment instruction (the QR a payer scans) for a workspace's account. */
export class PaymentInstructionRegistryService extends ProviderRegistryService<PaymentInstructionPort> {}

@Injectable()
/** The bank providers that list a connection's transactions to nodes and agents. */
export class BankTransactionsRegistryService extends ProviderRegistryService<BankTransactionsPort> {}

@Injectable()
/** The bank providers whose webhook feeds a workspace bank feed. */
export class FeedWebhookRegistryService extends ProviderRegistryService<FeedWebhookPort> {}

@Injectable()
/** The messaging providers whose inbox can be read back to catch the customer messages the webhook never delivered. */
export class MessageInboxPollerRegistryService extends ProviderRegistryService<MessageInboxPoller> {}

@Injectable()
/** The providers that keep the business ledger of a workspace. */
export class LedgerRegistryService extends ProviderRegistryService<LedgerPort> {}
