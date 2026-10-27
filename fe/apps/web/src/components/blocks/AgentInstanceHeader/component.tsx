import { Badge, Button, Heading, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { AgentMark } from "@/components/leaves/AgentMark"
import { ConnectionNeeds, type ConnectionNeedsProps } from "@/components/leaves/ConnectionNeeds"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { HEADER, HEADER_ACTIONS, HEADER_COPY, HEADER_TITLE } from "./classNames"

/** What the header shows once the instance is known, every word resolved. */
export interface InstanceHeaderView {
    readonly name: string
    readonly seed: string
    readonly avatarUrl: string | null
    readonly isEarly: boolean
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    /** "@handle - role - channels", already joined. */
    readonly subtitle: string
    /** What a `needs_connection` agent waits for and where to connect it; no lines otherwise. */
    readonly needs: ConnectionNeedsProps
    /** The 1:1 chat with the agent; null while the instance has no agent. */
    readonly chatHref: string | null
    /** The profile of the agent that drives this instance; null while the instance has no agent. */
    readonly profileHref: string | null
}

/** Copy and slot of the header of an agent instance. */
export interface AgentInstanceHeaderBaseProps {
    readonly props: {
        readonly earlyLabel: string
        readonly chatLabel: string
        readonly profileLabel: string
        readonly slot: DataSlot<InstanceHeaderView>
        readonly placeholder: InstanceHeaderView
        readonly slotLabels: SlotLabels
    }
}

/** Draws the header of an agent instance: avatar, name, status, the facts line and the two actions. */
export const AgentInstanceHeaderBase = (props: AgentInstanceHeaderBaseProps) => {
    const copy = props.props
    return (
        <SlotView slot={copy.slot} placeholder={copy.placeholder} labels={copy.slotLabels}>
            {(view, isSkeleton) => (
                <div className={HEADER}>
                    <AgentMark
                        label={view.name}
                        seed={view.seed}
                        src={view.avatarUrl}
                        size="control"
                        isSkeleton={isSkeleton}
                    />
                    <div className={HEADER_COPY}>
                        <div className={HEADER_TITLE}>
                            <Heading level={1} isSkeleton={isSkeleton}>
                                {view.name}
                            </Heading>
                            {view.isEarly ? <Badge tone="accent">{copy.earlyLabel}</Badge> : null}
                            <Badge isDot isSkeleton={isSkeleton} tone={view.statusTone}>
                                {view.statusLabel}
                            </Badge>
                        </div>
                        <Text size="sm" tone="muted" overflow="truncate" isSkeleton={isSkeleton}>
                            {view.subtitle}
                        </Text>
                        <ConnectionNeeds {...view.needs} />
                    </div>
                    <div className={HEADER_ACTIONS}>
                        {view.chatHref === null ? null : (
                            <Button intent="neutral" href={view.chatHref}>
                                {copy.chatLabel}
                            </Button>
                        )}
                        {view.profileHref === null ? null : (
                            <Button intent="neutral" href={view.profileHref}>
                                {copy.profileLabel}
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </SlotView>
    )
}
