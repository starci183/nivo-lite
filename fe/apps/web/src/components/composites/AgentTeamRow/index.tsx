import { Badge, Button, ListRow } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SetupMeter } from "@/components/branches/SetupMeter"
import { AgentMark } from "@/components/leaves/AgentMark"

/** What one installed agent shows on the catalogue, already in the reader language. */
export type AgentTeamRowProps = {
    readonly name: string
    readonly seed: string
    readonly avatarUrl: string | null
    /** "role · channel", already joined. */
    readonly description: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    /** "Setup 3/8". */
    readonly progressLabel: string
    readonly confirmed: number
    readonly total: number
    /** "Continue setup" while gates are open, else "Open". */
    readonly actionLabel: string
    readonly href: string
    /** The agent is not known yet: the row is a skeleton. */
    readonly isSkeleton: boolean
}

/** One installed agent as a row of the team: avatar, name, role and channel, its status, the setup meter and the next step. */
export const AgentTeamRow = (props: AgentTeamRowProps) => (
    <ListRow
        isSkeleton={props.isSkeleton}
        leading={<AgentMark label={props.name} seed={props.seed} src={props.avatarUrl} size="md" />}
        title={props.name}
        description={props.description}
        badges={
            <Badge isDot tone={props.statusTone}>
                {props.statusLabel}
            </Badge>
        }
        actions={
            <Button intent="neutral" size="sm" href={props.href}>
                {props.actionLabel}
            </Button>
        }
    >
        {props.total === 0 ? null : (
            <SetupMeter
                label={props.progressLabel}
                valueLabel={`${String(props.confirmed)}/${String(props.total)}`}
                confirmed={props.confirmed}
                total={props.total}
                size="sm"
            />
        )}
    </ListRow>
)
