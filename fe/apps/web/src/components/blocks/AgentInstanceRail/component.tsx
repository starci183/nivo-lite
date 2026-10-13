import { Badge, IconTile, Image, NavLandmark, Text, TextAction } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { RAIL, RAIL_COPY, RAIL_HEAD } from "./classNames"

/** One agent of the switcher on the left. */
export interface AgentInstanceRailItem {
    readonly id: string
    readonly href: string
    readonly name: string
    readonly mascot: string
    readonly isCurrent: boolean
    readonly statusLabel: string
    readonly statusTone: BadgeTone
}

/** Copy and state of the switcher of the installed agents. */
export interface AgentInstanceRailBaseProps {
    readonly props: {
        readonly navLabel: string
        readonly allAgentsLabel: string
        readonly allAgentsHref: string
        readonly items: ReadonlyArray<AgentInstanceRailItem>
        /** The facts of the agents are not known yet: the statuses are skeletons. */
        readonly isLoading: boolean
    }
}

/** Draws the installed agents (one row per instance) with the way back to the whole catalogue. */
export const AgentInstanceRailBase = (props: AgentInstanceRailBaseProps) => (
    <NavLandmark label={props.props.navLabel} layout="scrolling" className={RAIL}>
        <div className={RAIL_HEAD}>
            <TextAction href={props.props.allAgentsHref} size="sm" appearance="muted">
                {props.props.allAgentsLabel}
            </TextAction>
        </div>
        {props.props.items.map((item) => (
            <TextAction
                key={item.id}
                href={item.href}
                appearance="route"
                isCurrent={item.isCurrent}
                startContent={
                    <IconTile
                        source={nivoIconSource("apps", "leading")}
                        artwork={<Image src={item.mascot} alt="" aspect="square" fit="contain" plate="none" />}
                    />
                }
            >
                <div className={RAIL_COPY}>
                    <Text as="span" weight="semibold" size="sm">
                        {item.name}
                    </Text>
                    <Badge isDot isSkeleton={props.props.isLoading} tone={item.statusTone}>
                        {item.statusLabel}
                    </Badge>
                </div>
            </TextAction>
        ))}
    </NavLandmark>
)
