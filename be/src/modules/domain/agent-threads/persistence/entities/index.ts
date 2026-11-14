import { RunStopEntity } from "./run-stop.entity"

export { RunStopEntity }

/** The entities the agent threads own, collected by the database module. */
export const agentThreadsEntities: readonly [typeof RunStopEntity] = [RunStopEntity] as const
