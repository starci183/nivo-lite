import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import { BOOKING_FIXTURES } from "./booking"
import { CHATBOT_FIXTURES } from "./chatbot"
import { CONTENT_FIXTURES } from "./content"
import { HIRING_FIXTURES } from "./hiring"
import { PLATFORM_FIXTURES } from "./platform"
import { SALES_FIXTURES } from "./sales"
import { VIDEO_FIXTURES } from "./video"

/** The data of one read in each state a prototype draws: the answer when ready, and whether each other state exists for it. */
export interface ReadFixture {
    /** The data the read answers when ready. */
    readonly ready: unknown
    /** The data the read answers when ready for a viewer whose language is not the default (Vietnamese): a language that is absent reads `ready`. */
    readonly readyIn?: Readonly<Partial<Record<"vi" | "en", unknown>>>
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
    sales: SALES_FIXTURES,
    chatbot: CHATBOT_FIXTURES,
    platform: PLATFORM_FIXTURES,
    hiring: HIRING_FIXTURES,
    booking: BOOKING_FIXTURES,
    video: VIDEO_FIXTURES,
    content: CONTENT_FIXTURES,
}
