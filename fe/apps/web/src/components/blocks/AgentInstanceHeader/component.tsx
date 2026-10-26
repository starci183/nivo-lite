import { Badge, Button, Heading, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { ConnectionNeeds, type ConnectionNeedsProps } from "@/components/leaves/ConnectionNeeds"
import { HEADER, HEADER_ACTIONS, HEADER_COPY, HEADER_TITLE } from "./classNames"

/** Copy and state of the header of an agent instance. */
export interface AgentInstanceHeaderBaseProps {
    readonly props: {
        readonly name: string
        readonly seed: string
        readonly avatarUrl: string | null
        readonly isEarly: boolean
        readonly earlyLabel: string
        readonly statusLabel: string
        readonly statusTone: BadgeTone
        /** "@handle - role - channels", already joined. */
        readonly subtitle: string
        /** What a `needs_connection` agent waits for and where to connect it; no lines otherwise. */
        readonly needs: ConnectionNeedsProps
        /** The 1:1 chat with the agent; null while the instance has no agent. */
        readonly chatHref: string | null
        readonly chatLabel: string
        /** The profile of the agent that drives this instance; null while the instance has no agent. */
        readonly profileHref: string | null
        readonly profileLabel: string
        /** The facts of the agent are not known yet: the name, status and subtitle are skeletons. */
        readonly isLoading: boolean
    }
}

/** Draws the header of an agent instance: avatar, name, status, the facts line and the two actions. */
export const AgentInstanceHeaderBase = (props: AgentInstanceHeaderBaseProps) => {
    const view = props.props
    return (
        <div className={HEADER}>
            <AgentMark
                label={view.name}
                seed={view.seed}
                src={view.avatarUrl}
                size="control"
                isSkeleton={view.isLoading}
            />
            <div className={HEADER_COPY}>
                <div className={HEADER_TITLE}>
                    <Heading level={1} isSkeleton={view.isLoading}>
                        {view.name}
                    </Heading>
                    {view.isEarly ? <Badge tone="accent">{view.earlyLabel}</Badge> : null}
                    <Badge isDot isSkeleton={view.isLoading} tone={view.statusTone}>
                        {view.statusLabel}
                    </Badge>
                </div>
                <Text size="sm" tone="muted" overflow="truncate" isSkeleton={view.isLoading}>
                    {view.subtitle}
                </Text>
                <ConnectionNeeds {...view.needs} />
            </div>
            <div className={HEADER_ACTIONS}>
                {view.chatHref === null ? null : (
                    <Button intent="neutral" href={view.chatHref}>
                        {view.chatLabel}
                    </Button>
                )}
                {view.profileHref === null ? null : (
                    <Button intent="neutral" href={view.profileHref}>
                        {view.profileLabel}
                    </Button>
                )}
            </div>
        </div>
    )
}
