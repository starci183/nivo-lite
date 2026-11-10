import type { AgentActionActivity, AgentResponseTime, AgentWaiting, WaitingApproval } from "@modules/domain/work-items"
import type { AgentRow, ApprovalRow, Rate } from "../workspace-dashboard.contracts"
import { rateOf } from "./dashboard-facts.policy"
import { minutesSavedBy } from "./saved-minutes.policy"

/** The part of an agent the table needs. */
export interface DashboardAgent {
    /** The agent. */
    readonly id: string
    /** The module the agent belongs to. */
    readonly module: string
    /** The display name. */
    readonly name: string
    /** The @handle. */
    readonly handle: string
}

/** The part of an installation that says which agent an instance of a type is. */
export interface DashboardInstallation {
    /** The installation. */
    readonly id: string
    /** The agent of the installation, or null while it has none. */
    readonly agentId: string | null
}

/** Whose items are whose: the agents oldest first, and the instances that name an agent. */
export interface AgentDirectory {
    /** The agents, oldest first. */
    readonly agents: ReadonlyArray<DashboardAgent>
    /** The installations by id. */
    readonly installations: ReadonlyArray<DashboardInstallation>
}

/** What a department and an instance point at. */
interface ItemKey {
    readonly department: string
    readonly installationId: string | null
}

/**
 * The agent an item belongs to: the agent of its instance when it names one, else the oldest agent of its department. An item no
 * agent answers for (its agent was removed) belongs to none.
 */
export const agentOfItem = (directory: AgentDirectory, key: ItemKey): DashboardAgent | null => {
    const known = (id: string | null): DashboardAgent | null =>
        directory.agents.find((agent) => agent.id === id) ?? null
    const instance = directory.installations.find((installation) => installation.id === key.installationId)
    const byInstance = instance === undefined ? null : known(instance.agentId)
    return byInstance ?? directory.agents.find((agent) => agent.module === key.department) ?? null
}

const sumBy = <T>(items: ReadonlyArray<T>, valueOf: (item: T) => number): number =>
    items.reduce((total, item) => total + valueOf(item), 0)

/** The auto rates of the whole workspace: items finished by policy alone over items finished, now and in the period before. */
export const autoRatesOf = (activity: ReadonlyArray<AgentActionActivity>): Rate => ({
    current: rateOf(
        sumBy(activity, (row) => row.autoDone),
        sumBy(activity, (row) => row.done),
    ),
    previous: rateOf(
        sumBy(activity, (row) => row.previousAutoDone),
        sumBy(activity, (row) => row.previousDone),
    ),
})

/** The average of the numbers, or null for none. */
const meanOf = (values: ReadonlyArray<number>): number | null =>
    values.length === 0 ? null : values.reduce((total, value) => total + value, 0) / values.length

/** What the table of agents is read from. */
export interface AgentTableInput {
    /** Whose items are whose. */
    readonly directory: AgentDirectory
    /** What was finished and failed, by department, instance and action. */
    readonly activity: ReadonlyArray<AgentActionActivity>
    /** The median time to finish by policy alone, by department and instance. */
    readonly responses: ReadonlyArray<AgentResponseTime>
    /** The items that wait for a decision now, by department and instance. */
    readonly waiting: ReadonlyArray<AgentWaiting>
    /** Credits spent in the period, by module. */
    readonly creditsByModule: ReadonlyMap<string, number>
    /** Runs that failed or were handed to a person, by agent id. */
    readonly failedRunsByAgent: ReadonlyMap<string, number>
}

/** One row per installed agent, in the order of the directory; an agent that did nothing has a row of zeros. */
export const agentRowsOf = (input: AgentTableInput): ReadonlyArray<AgentRow> => {
    const { directory } = input
    const mine = <T extends ItemKey>(rows: ReadonlyArray<T>, agent: DashboardAgent): ReadonlyArray<T> =>
        rows.filter((row) => agentOfItem(directory, row)?.id === agent.id)
    return directory.agents.map((agent) => {
        const activity = mine(input.activity, agent)
        const done = sumBy(activity, (row) => row.done)
        const medians = mine(input.responses, agent).flatMap((row) =>
            row.medianSeconds === null ? [] : [row.medianSeconds],
        )
        const firstOfModule = directory.agents.find((candidate) => candidate.module === agent.module)?.id === agent.id
        return {
            agentId: agent.id,
            name: agent.name,
            handle: agent.handle,
            module: agent.module,
            tasksDone: done,
            autoRate: rateOf(
                sumBy(activity, (row) => row.autoDone),
                done,
            ),
            waiting: sumBy(mine(input.waiting, agent), (row) => row.waiting),
            errors: sumBy(activity, (row) => row.failed) + (input.failedRunsByAgent.get(agent.id) ?? 0),
            medianResponseSeconds: meanOf(medians),
            minutesSaved: minutesSavedBy(activity.map((row) => ({ action: row.action, count: row.done }))),
            credits: firstOfModule ? (input.creditsByModule.get(agent.module) ?? 0) : 0,
        }
    })
}

/** The path inside the workspace that opens a work item in its agent's workbench. */
export const decisionPathOf = (department: string, installationId: string | null, workItemId: string): string => {
    const base = installationId === null ? `/agents/${department}` : `/agents/${department}/${installationId}`
    return `${base}/workbench?focus=${workItemId}`
}

/** An item that waits for the owner, with the agent it belongs to named and the path that opens it. */
export const approvalRowOf = (directory: AgentDirectory, item: WaitingApproval): ApprovalRow => ({
    id: item.id,
    agentName: agentOfItem(directory, item)?.name ?? null,
    action: item.action,
    summary: item.summary,
    customer: item.customer,
    createdAt: item.createdAt,
    href: decisionPathOf(item.department, item.installationId, item.id),
})
