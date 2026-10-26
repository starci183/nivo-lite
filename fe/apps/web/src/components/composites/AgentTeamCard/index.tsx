import { Badge, Icon, SurfaceCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { nivoIconSource } from "@/components/leaves/Icon"
import { COPY, META, ROW } from "./classNames"

/** What one installed agent shows on the catalogue, already in the reader language. */
export type AgentTeamCardProps = {
    readonly name: string
    readonly seed: string
    readonly roleName: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly href: string
    /** The agent is not known yet: the lines are skeletons. */
    readonly isLoading: boolean
}

/** One installed agent as a person of the team: avatar with the bot badge, name, "role - status", a chevron; the whole card opens the agent. */
export const AgentTeamCard = (props: AgentTeamCardProps) => (
    <SurfaceCard ariaLabel={props.name} wholeAction={{ kind: "link", href: props.href, label: props.name }}>
        <div className={ROW}>
            <AgentMark label={props.name} seed={props.seed} size="md" />
            <div className={COPY}>
                <Text weight="semibold" overflow="truncate" isSkeleton={props.isLoading}>
                    {props.name}
                </Text>
                <div className={META}>
                    <Text size="sm" tone="muted" overflow="truncate" isSkeleton={props.isLoading}>
                        {props.roleName}
                    </Text>
                    <Badge isDot tone={props.statusTone} isSkeleton={props.isLoading}>
                        {props.statusLabel}
                    </Badge>
                </div>
            </div>
            <Icon source={nivoIconSource("disclosure", "leading")} usage="leading" />
        </div>
    </SurfaceCard>
)
