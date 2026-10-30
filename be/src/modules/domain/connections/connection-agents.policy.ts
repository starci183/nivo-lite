/** The agent ids of a connection in an app that composes no agents: no connection is used by any agent. */
export const noAgentIds = (): Promise<ReadonlyArray<string>> => Promise.resolve([])
