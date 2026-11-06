import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import { ACCOUNTING_FIXTURES, PAYMENT_FIXTURES } from "./accounting"
import { CHATBOT_FIXTURES } from "./chatbot"
import { LOYALTY_FIXTURES } from "./loyalty"
import { PLATFORM_FIXTURES } from "./platform"
import { SALES_FIXTURES } from "./sales"

/** The data of one read in each state a prototype draws: the answer when ready, and whether each other state exists for it. */
export interface ReadFixture {
    /** The data the read answers when ready. */
    readonly ready: unknown
    /** The data the read answers when it has nothing; absent when the read cannot be empty. */
    readonly empty?: unknown
    /** The data of a read that waits for the owner, when the read has such a state. */
    readonly waiting?: unknown
}

/** The fixtures of one module: each read by id, and the answer of each action by id. */
export interface ModuleFixtures {
    /** The fixture of each read of the module, by read id. */
    readonly reads: Readonly<Record<string, ReadFixture>>
    /** The answer of each action of the module, by action id. */
    readonly actions: Readonly<Record<string, ActionResult>>
}

/**
 * The fixtures of every module, by module key: what the prototype data port answers, so a screen is drawn and shot in every
 * state without a back end. Imported only by the prototype host; production bundles never reach it.
 */
export const MODULE_FIXTURES: Readonly<Record<string, ModuleFixtures>> = {
    loyalty: LOYALTY_FIXTURES,
    sales: SALES_FIXTURES,
    chatbot: CHATBOT_FIXTURES,
    accounting: ACCOUNTING_FIXTURES,
    payment: PAYMENT_FIXTURES,
    platform: PLATFORM_FIXTURES,
}
