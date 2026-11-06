import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { salesAttentionCardBlock } from "../../blocks/sales/attention-card.block"
import data from "./attention-card.data.json"

/** One record a read of the attention card answers. */
export interface AttentionFixtureRecord {
    /** The customer, order or step the row is about. */
    readonly id: string
    /** The name on the row. */
    readonly title: string
    /** The line under the name. */
    readonly description: string
    /** Why the row waits, as a code the card gives words to. */
    readonly reason: string
    /** Since when the row waits, ISO text. */
    readonly at: string
}

/** The three reads the card fills its list from, in one status. */
export interface AttentionFixtureSlots {
    /** The deals past their step and the questions for the owner. */
    readonly attention: DataSlot<ReadonlyArray<AttentionFixtureRecord>>
    /** The customers waiting for a reply. */
    readonly awaitingReply: DataSlot<ReadonlyArray<AttentionFixtureRecord>>
    /** The steps that failed. */
    readonly failedSteps: DataSlot<ReadonlyArray<AttentionFixtureRecord>>
}

/** The props the card is drawn with on the Sales board. */
export const attentionCardFixtureProps: z.infer<(typeof salesAttentionCardBlock)["props"]> = data.props

/** The deals past their next step and the question the assistant has for the owner. */
export const ATTENTION_RECORDS: ReadonlyArray<AttentionFixtureRecord> = data.attention

/** The customer who waits for a reply. */
export const AWAITING_REPLY_RECORDS: ReadonlyArray<AttentionFixtureRecord> = data.awaitingReply

/** The step that failed. */
export const FAILED_STEP_RECORDS: ReadonlyArray<AttentionFixtureRecord> = data.failedSteps

/** The order over the limit that waits for the owner's approval. */
export const OWNER_RECORDS: ReadonlyArray<AttentionFixtureRecord> = data.owner

/** Every status the attention card is drawn in. */
export interface AttentionCardFixtures {
    /** The ready state. */
    readonly ready: AttentionFixtureSlots
    /** The loading state. */
    readonly loading: AttentionFixtureSlots
    /** The empty state. */
    readonly empty: AttentionFixtureSlots
    /** The error state. */
    readonly error: AttentionFixtureSlots
    /** The waiting state. */
    readonly waiting: AttentionFixtureSlots
}

/** The card in every status: ready with all four kinds, loading, empty, failed, and waiting on the owner's approval. */
export const attentionCardFixtures: AttentionCardFixtures = {
    ready: {
        attention: { items: ATTENTION_RECORDS },
        awaitingReply: { items: AWAITING_REPLY_RECORDS },
        failedSteps: { items: FAILED_STEP_RECORDS },
    },
    loading: {
        attention: { isLoading: true },
        awaitingReply: { isLoading: true },
        failedSteps: { isLoading: true },
    },
    empty: { attention: { isEmpty: true }, awaitingReply: { isEmpty: true }, failedSteps: { isEmpty: true } },
    error: { attention: { isError: true }, awaitingReply: { isEmpty: true }, failedSteps: { isEmpty: true } },
    waiting: {
        attention: { items: OWNER_RECORDS },
        awaitingReply: { isEmpty: true },
        failedSteps: { isEmpty: true },
    },
}
