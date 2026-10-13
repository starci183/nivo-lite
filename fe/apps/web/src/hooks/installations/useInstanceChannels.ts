import { useCallback } from "react"
import { useQueryConnectionsSwr } from "@/hooks/swr/api/graphql/queries/useQueryConnectionsSwr"

/** The names of the connections an agent is bound to (disconnected ones left out); empty while they load or when they cannot be read. */
export const useInstanceChannels = (): ((agentId: string | null) => ReadonlyArray<string>) => {
    const read = useQueryConnectionsSwr()
    const connections = read.data
    return useCallback(
        (agentId: string | null) =>
            agentId === null || connections === undefined
                ? []
                : connections
                      .filter(
                          (connection) => connection.status !== "disconnected" && connection.agentIds.includes(agentId),
                      )
                      .map((connection) => connection.name),
        [connections],
    )
}
