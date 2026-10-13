import useSWR from "swr"
import type { InboundSimulationStatusType } from "@/modules/api"
import { queryInboundSimulationStatus } from "@/modules/api/graphql/queries/query-inbound-simulation-status"

/** The identity of the simulator status cache. */
export const QUERY_INBOUND_SIMULATION_STATUS_SWR_KEY = "QUERY_INBOUND_SIMULATION_STATUS_SWR"

/** Whether the status is final: nothing more will change in it. */
const isFinal = (status: InboundSimulationStatusType | undefined): boolean =>
    status?.status === "succeeded" || status?.status === "failed"

/** Polls a simulated delivery until it succeeds or fails; `onSettled` hears each final result. */
export const useQueryInboundSimulationStatusSwr = (
    workspaceId: string,
    id: string | undefined,
    delivery: number,
    onSettled: (status: InboundSimulationStatusType) => void,
) =>
    useSWR(
        id === undefined ? null : [QUERY_INBOUND_SIMULATION_STATUS_SWR_KEY, workspaceId, id, delivery],
        async ([, scope, eventId]: readonly [string, string, string, number]) => {
            const result = await queryInboundSimulationStatus({
                request: { id: eventId },
                headers: { "X-Workspace-Id": scope },
            })
            if (!result.data) throw new Error("inboundSimulationStatus answered no data")
            return result.data.inboundSimulationStatus
        },
        {
            refreshInterval: (data) => (isFinal(data) ? 0 : 2000),
            revalidateOnFocus: false,
            onSuccess: (data) => {
                if (isFinal(data)) onSettled(data)
            },
        },
    )
