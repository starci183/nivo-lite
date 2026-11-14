/** The durable queue the agent graph watch runs on. The name is the contract with the job ticks that enqueue. */
export const DECISIONS_QUEUE = "decisions"

/** The jobs of the decisions queue; the value is the job name inside the queue. */
export enum DecisionsJob {
    /** The scheduler tick that seeds the graphs of agents that have none, raises what ended decisions teach and compares the Brain rules behind the graphs. */
    AgentGraphWatch = "decisions.agent-graph-watch",
}
