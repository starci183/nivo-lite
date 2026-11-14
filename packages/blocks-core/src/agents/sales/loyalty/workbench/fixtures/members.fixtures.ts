import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { loyaltyMembersBlock } from "../blocks/members.block"
import type { TabCounts } from "../../../../../shared/rows/filter-tabs"
import data from "./members.data.json"

/** One record a read of the members block answers. */
export interface MemberFixtureRecord {
    /** The customer id. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The phone or email. */
    readonly contact: string
    /** The name of the held tier. */
    readonly tier: string
    /** The points held. */
    readonly points: number
    /** When the last purchase earned points, ISO text. */
    readonly lastVisitAt: string
    /** Whether the customer is active, has gone quiet or is new. */
    readonly activity: string
}

/** One tier of the sample ladder. */
export interface TierFixtureRecord {
    /** The key the members read filters by. */
    readonly key: string
    /** The name the owner gave the tier. */
    readonly name: string
}

/** The reads of the block in one status. */
export interface MembersFixtureSlots {
    /** The members. */
    readonly rows: DataSlot<ReadonlyArray<MemberFixtureRecord>>
    /** The ladder. */
    readonly tiers: DataSlot<ReadonlyArray<TierFixtureRecord>>
    /** The members of each tier. */
    readonly tierCounts: DataSlot<TabCounts>
    /** The members of each activity. */
    readonly activityCounts: DataSlot<TabCounts>
}

/** The props the block is drawn with on the Loyalty board. */
export const membersFixtureProps: z.infer<(typeof loyaltyMembersBlock)["props"]> = data.props

/** The sample ladder: the names are the owner's own, so a renamed ladder reads the same way. */
export const TIER_RECORDS: ReadonlyArray<TierFixtureRecord> = data.tiers

/** The sample members. */
export const MEMBER_RECORDS: ReadonlyArray<MemberFixtureRecord> = data.members

const TIER_COUNTS: TabCounts = { counts: { gold: 84, silver: 312, bronze: 690 }, total: 1_086 }
const ACTIVITY_COUNTS: TabCounts = { counts: { active: 412, at_risk: 96, new: 12 }, total: 1_086 }
const NO_COUNTS: TabCounts = { counts: { gold: 0, silver: 0, bronze: 0 }, total: 0 }

/** Every status the members list is drawn in. */
export interface MembersFixtures {
    /** The ready state. */
    readonly ready: MembersFixtureSlots
    /** The loading state. */
    readonly loading: MembersFixtureSlots
    /** The empty state. */
    readonly empty: MembersFixtureSlots
    /** The error state. */
    readonly error: MembersFixtureSlots
    /** The waiting state. */
    readonly waiting: MembersFixtureSlots
}

/** The block in every status: ready, loading, empty (no members yet), failed, and the tab of the members who went quiet. */
export const membersFixtures: MembersFixtures = {
    ready: {
        rows: { items: MEMBER_RECORDS },
        tiers: { items: TIER_RECORDS },
        tierCounts: { items: TIER_COUNTS },
        activityCounts: { items: ACTIVITY_COUNTS },
    },
    loading: {
        rows: { isLoading: true },
        tiers: { isLoading: true },
        tierCounts: { isLoading: true },
        activityCounts: { isLoading: true },
    },
    empty: {
        rows: { isEmpty: true },
        tiers: { items: TIER_RECORDS },
        tierCounts: { items: NO_COUNTS },
        activityCounts: { items: NO_COUNTS },
    },
    error: {
        rows: { isError: true },
        tiers: { isError: true },
        tierCounts: { isError: true },
        activityCounts: { isError: true },
    },
    waiting: {
        rows: { items: MEMBER_RECORDS.filter((member) => member.activity === "at_risk") },
        tiers: { items: TIER_RECORDS },
        tierCounts: { items: TIER_COUNTS },
        activityCounts: { items: ACTIVITY_COUNTS },
    },
}
