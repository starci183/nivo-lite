import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import type { PortsOf } from "@nivo-lite/agent-sdk/port"
import { z } from "zod"
import type { DecisionQueueView, ItemsRegionView } from "../../../views/views.types"
import { DECISIONS_LIMIT, LOYALTY_DECIDE, WAITING_SHOWN } from "../constants"
import { decisionQueueOf, loyaltyDecisionsOf, waitingRegionOf } from "../mappers"
import type { DecisionItem } from "../loyalty.types"
import { decisionsWaiting } from "../loyalty-catalogue-data"
import { DECISIONS } from "../ports"
import type { PendingCount } from "../views.types"

const variables: z.ZodObject<Record<string, never>> = z.object({})

const ports = { decisions: DECISIONS }

/** The loyalty decisions that wait for a person. */
const waitingOf = async (held: PortsOf<typeof ports>): Promise<ReadonlyArray<DecisionItem>> =>
    loyaltyDecisionsOf(await decisionsWaiting(held.decisions, DECISIONS_LIMIT))

/** `loyalty.pending`: the decisions about points, rewards and promotions that wait for a person, oldest first. */
export const pendingRead: ReadDefinition = defineRead({
    id: "loyalty.pending",
    dataKind: "loyalty-decision",
    shape: "record",
    fields: ["count", "more", "rows"],
    paths: { rows: "list" },
    variables,
    permission: LOYALTY_DECIDE,
    ports,
    run: async (held, _variables, context): Promise<DecisionQueueView> =>
        decisionQueueOf(await waitingOf(held), context.now.getTime()),
})

/** `loyalty.pending-waiting`: the first decisions waiting for the owner, as the overview region reads them. */
export const pendingWaitingRead: ReadDefinition = defineRead({
    id: "loyalty.pending-waiting",
    dataKind: "loyalty-waiting",
    shape: "record",
    fields: ["count", "rows", "linkLabel", "linkHref", "more"],
    paths: { rows: "list" },
    variables,
    permission: LOYALTY_DECIDE,
    ports,
    run: async (held): Promise<ItemsRegionView> => waitingRegionOf(await waitingOf(held), WAITING_SHOWN),
})

/** `loyalty.pending-count`: how many decisions wait, for the count on the tab. */
export const pendingCountRead: ReadDefinition = defineRead({
    id: "loyalty.pending-count",
    dataKind: "loyalty-pending-count",
    shape: "record",
    fields: ["count"],
    paths: {},
    variables,
    permission: LOYALTY_DECIDE,
    ports,
    run: async (held): Promise<PendingCount> => ({ count: (await waitingOf(held)).length }),
})
