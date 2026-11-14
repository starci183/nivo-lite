import { SALES_VIEW } from "../../constants"
import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../../bounds"
import { rewardViewOf } from "../mappers"
import { rewardById, rewardsList } from "../loyalty-catalogue-data"
import { REWARDS } from "../ports"
import type { RewardView } from "../views.types"

const REWARD_FIELDS: ReadonlyArray<keyof RewardView> = [
    "id",
    "name",
    "kind",
    "valueVnd",
    "percent",
    "pointsCost",
    "stock",
    "perCustomerLimit",
    "minTierKey",
    "note",
    "active",
    "state",
]

/** `blocks-core.sales.api.loyalty-reward.list`: the whole catalogue, paused rewards included. */
export const rewardsRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.loyalty-reward.list",
    dataKind: "loyalty-reward",
    shape: "record",
    fields: ["rows"],
    paths: { rows: "list" },
    variables: z.object({}),
    permission: SALES_VIEW,
    ports: { rewards: REWARDS },
    run: async ({ rewards }): Promise<{ readonly rows: ReadonlyArray<RewardView> }> => ({
        rows: (await rewardsList(rewards, false)).map((item) => rewardViewOf(item)),
    }),
})

/** `blocks-core.sales.api.loyalty-reward.get`: one reward, which the reward form starts from; null when there is none. */
export const rewardRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.loyalty-reward.get",
    dataKind: "loyalty-reward",
    shape: "record",
    fields: REWARD_FIELDS,
    paths: {},
    variables: z.object({ id: z.string().min(1).max(MAX_ID) }),
    permission: SALES_VIEW,
    ports: { rewards: REWARDS },
    run: async ({ rewards }, { id }): Promise<RewardView | null> => {
        const reward = await rewardById(rewards, id)
        return reward === null ? null : rewardViewOf(reward)
    },
})
