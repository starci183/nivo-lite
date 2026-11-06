import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { salesPipelineBlock } from "../../blocks/sales/pipeline.block"
import type { TabCounts } from "../../rows/filter-tabs"
import data from "./pipeline.data.json"

/** One lead as the leads read answers it for the pipeline. */
export interface PipelineFixtureRecord {
    /** The lead id. */
    readonly id: string
    /** The customer. */
    readonly contactName: string
    /** The company, empty when unknown. */
    readonly company: string
    /** What the customer needs. */
    readonly need: string
    /** Where the deal stands. */
    readonly stage: string
    /** The channel the customer came through. */
    readonly channel: string
    /** When the lead last changed, ISO text. */
    readonly updatedAt: string
    /** Who looks after the deal. */
    readonly owner?: string
    /** The next step of the deal. */
    readonly nextStep?: string
    /** The day the next step is due. */
    readonly nextDueAt?: string
    /** The amount of the quote, VND. */
    readonly quoteVnd?: number
    /** The amount of the order, VND. */
    readonly orderVnd?: number
    /** A line about where the deal stands. */
    readonly note?: string
    /** Why the deal was lost. */
    readonly closedReason?: string
}

/** The reads of the pipeline in one status. */
export interface PipelineFixtureSlots {
    /** The leads. */
    readonly rows: DataSlot<ReadonlyArray<PipelineFixtureRecord>>
    /** How many leads each stage holds. */
    readonly counts: DataSlot<TabCounts>
}

/** The props the pipeline is drawn with on the Sales board. */
export const pipelineFixtureProps: z.infer<(typeof salesPipelineBlock)["props"]> = data.props

/** The sample leads, one or two in each stage. */
export const PIPELINE_RECORDS: ReadonlyArray<PipelineFixtureRecord> = data.records

const COUNTS: TabCounts = { counts: { new: 6, qualified: 5, proposal: 7, won: 9, lost: 3 }, total: 30 }
const NO_COUNTS: TabCounts = { counts: { new: 0, qualified: 0, proposal: 0, won: 0, lost: 0 }, total: 0 }

/** Every status the pipeline is drawn in. */
export interface PipelineFixtures {
    /** The ready state. */
    readonly ready: PipelineFixtureSlots
    /** The loading state. */
    readonly loading: PipelineFixtureSlots
    /** The empty state. */
    readonly empty: PipelineFixtureSlots
    /** The error state. */
    readonly error: PipelineFixtureSlots
    /** The waiting state. */
    readonly waiting: PipelineFixtureSlots
}

/** The pipeline in every status: ready with a card in each stage, loading, empty, failed, and with a quote waiting for the owner. */
export const pipelineFixtures: PipelineFixtures = {
    ready: { rows: { items: PIPELINE_RECORDS }, counts: { items: COUNTS } },
    loading: { rows: { isLoading: true }, counts: { isLoading: true } },
    empty: { rows: { isEmpty: true }, counts: { items: NO_COUNTS } },
    error: { rows: { isError: true }, counts: { isError: true } },
    waiting: {
        rows: { items: PIPELINE_RECORDS.filter((record) => record.stage === "proposal") },
        counts: { items: COUNTS },
    },
}
