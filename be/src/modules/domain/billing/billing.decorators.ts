import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { BillingOptions } from "./billing.options"

/** Token of the billing options, exported so a spec can provide it. */
export const BILLING_OPTIONS: unique symbol = Symbol("domain.billing.options")

/** Injects the options of the billing capability. Parameter type: BillingOptions. */
export const InjectBillingOptions = (): TypedParameterDecorator<BillingOptions> =>
    injector<BillingOptions>(BILLING_OPTIONS)

/** What the bank feed asks the agent graphs: whether the agent bound to a connection has a flow in its live version. */
export interface BankFeedFlow {
    /** True when the live version of the agent's graph has a flow of nodes. */
    hasLiveFlow(workspaceId: string, agentId: string): Promise<boolean>
}

/** Token of the flow port, bound by the capability that owns the agent graphs; with none bound the bank feed tags no agent. */
export const BANK_FEED_FLOW: unique symbol = Symbol("domain.billing.bank-feed-flow")

/** Injects the flow port. Parameter type: BankFeedFlow. */
export const InjectBankFeedFlow = (): TypedParameterDecorator<BankFeedFlow> => injector<BankFeedFlow>(BANK_FEED_FLOW)
