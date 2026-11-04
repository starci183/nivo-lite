import { SetupMeter } from "@/components/branches/SetupMeter"

interface AgentTeamRowProps {
    readonly progressLabel: string
    readonly confirmed: number
    readonly total: number
    readonly isLoading: boolean
}

/** An installed agent as native row data, preserving the approved mascot, agent identity, status and setup progress. */
export const AgentTeamRow = (props: AgentTeamRowProps) => {
    return props.total === 0 || (props.confirmed === props.total && !props.isLoading) ? undefined : (
        <SetupMeter
            label={props.progressLabel}
            valueLabel={`${String(props.confirmed)}/${String(props.total)}`}
            confirmed={props.confirmed}
            total={props.total}
            size="sm"
            isLoading={props.isLoading === true}
        />
    )
}
