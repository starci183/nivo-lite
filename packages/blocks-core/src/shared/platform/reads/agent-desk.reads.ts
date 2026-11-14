import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { deskFlowsOf, deskLocaleOf, deskQueueOf, type DeskFlowsView } from "../agent-desk"
import { PLATFORM_VIEW } from "../constants"
import type { AgentReachView, AgentTodayView } from "../platform.types"
import { agentDeskPort } from "../ports"
import type { DecisionQueueView } from "../../views/views.types"

/** Every desk read names the installation whose agent it reads. */
const installationOnly: z.ZodObject<{ installation: z.ZodUUID }> = z.object({ installation: z.uuid() })

/**
 * `platform.agent-flows`: how the agent works. Every active workflow of the installation's agent, the primary first, each with the card
 * view of the graph version that runs (the same view the workflow canvas reads: never written by hand), and the totals of the head.
 */
export const agentFlowsRead: ReadDefinition = defineRead({
    id: "platform.agent-flows",
    dataKind: "platform-agent-flows",
    shape: "record",
    fields: ["workflows", "steps", "flows"],
    paths: { flows: "list" },
    variables: installationOnly,
    permission: PLATFORM_VIEW,
    ports: { desk: agentDeskPort },
    run: async ({ desk }, { installation }, context): Promise<DeskFlowsView> =>
        deskFlowsOf(await desk.flows(installation), deskLocaleOf(context.locale)),
})

/**
 * `platform.waiting-on-person`: the agent's runs stopped on a person, newest first, as the decision queue draws them. An approval offers
 * the two verdicts (`approve`, `decline`) that `platform.approval-decide` takes; any other stop offers none: it is answered on its card in
 * /chat. Replaces `platform.parked-runs`, which the threads engine leaves empty.
 */
export const waitingOnPersonRead: ReadDefinition = defineRead({
    id: "platform.waiting-on-person",
    dataKind: "platform-waiting-on-person",
    shape: "record",
    fields: ["count", "more", "rows"],
    paths: { rows: "list" },
    variables: installationOnly,
    permission: PLATFORM_VIEW,
    ports: { desk: agentDeskPort },
    run: async ({ desk }, { installation }, context): Promise<DecisionQueueView> =>
        deskQueueOf(installation, await desk.waiting(installation), {
            locale: context.locale,
            timeZone: context.timeZone,
            now: context.now,
        }),
})

/**
 * `platform.agent-today`: what the agent did on the workspace's day: the runs that ended done, the records read and changed (null = calls
 * were made and none stated a count: a dash, never 0).
 */
export const agentTodayRead: ReadDefinition = defineRead({
    id: "platform.agent-today",
    dataKind: "platform-agent-today",
    shape: "record",
    fields: ["day", "answered", "recordsRead", "recordsChanged", "uncounted"],
    paths: {},
    variables: installationOnly,
    permission: PLATFORM_VIEW,
    ports: { desk: agentDeskPort },
    run: ({ desk }, { installation }, context): Promise<AgentTodayView> =>
        desk.today(installation, { timeZone: context.timeZone, now: context.now }),
})

/** `platform.agent-reach`: the accounts the agent is attached to and the operations it does by itself, asks first, or never does. */
export const agentReachRead: ReadDefinition = defineRead({
    id: "platform.agent-reach",
    dataKind: "platform-agent-reach",
    shape: "record",
    fields: ["accounts", "auto", "ask", "none"],
    paths: { accounts: "list" },
    variables: installationOnly,
    permission: PLATFORM_VIEW,
    ports: { desk: agentDeskPort },
    run: ({ desk }, { installation }): Promise<AgentReachView> => desk.reach(installation),
})
