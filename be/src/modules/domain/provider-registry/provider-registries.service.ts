import { Injectable } from "@nestjs/common"
import { ProviderRegistry } from "./provider-registry.service"
import type {
    BankFeedPoller,
    BankTransactionsPort,
    MessageInboxPoller,
    PaymentInstructionPort,
} from "./provider-ports.contracts"

@Injectable()
/** The bank providers whose transactions can be read back to catch what the webhook never delivered. */
export class BankFeedPollerRegistry extends ProviderRegistry<BankFeedPoller> {}

@Injectable()
/** The bank providers that build the payment instruction (the QR a payer scans) for a workspace's account. */
export class PaymentInstructionRegistry extends ProviderRegistry<PaymentInstructionPort> {}

@Injectable()
/** The bank providers that list a connection's transactions to nodes and agents. */
export class BankTransactionsRegistry extends ProviderRegistry<BankTransactionsPort> {}

@Injectable()
/** The messaging providers whose inbox can be read back to catch the customer messages the webhook never delivered. */
export class MessageInboxPollerRegistry extends ProviderRegistry<MessageInboxPoller> {}
