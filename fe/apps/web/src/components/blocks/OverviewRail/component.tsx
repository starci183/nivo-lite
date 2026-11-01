import { nivoIconSource, type IconName } from "@/components/leaves/Icon"
import { Badge, Button, EmptyNotice, ListRow, Stack, SurfaceListCard, Text, TextAction } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { TileIcon } from "@/components/composites/TileIcon"
import type { ModuleIconName } from "@/modules/types"

/** One agent row. */
interface OverviewRailAgent {
    readonly id: string
    readonly module: string
    readonly glyph: ModuleIconName
    readonly name: string
    /** The picture the owner gave the agent; null draws the NIVO unicorn mascot. */
    readonly avatarUrl: string | null
    readonly isActive: boolean
    readonly statusLabel: string
    readonly chatHref: string
}

/** One recent-activity row. */
interface OverviewRailActivity {
    readonly id: string
    readonly icon: IconName
    readonly actor: string
    readonly summary: string
    readonly timeLabel: string
    readonly href: string | null
}

/** The resolved words and rows of the overview rail. */
interface OverviewRailBaseProps {
    readonly props: {
        readonly agentsTitle: string
        readonly agentsEmpty: string
        readonly agentsEmptyBody: string
        readonly chatLabel: string
        readonly buyChatbotLabel: string | null
        readonly buyChatbotHref: string
        readonly agents: ReadonlyArray<OverviewRailAgent>
        readonly activityTitle: string
        readonly activityEmpty: string
        readonly activityEmptyBody: string
        readonly viewAllLabel: string
        readonly viewAllHref: string
        readonly activity: ReadonlyArray<OverviewRailActivity>
        /** The dashboard is still read: both cards draw their own skeleton rows. */
        readonly isSkeleton: boolean
    }
}

/** The rail beside the open work: onboarding progress, the agents and the recent activity. */
export const OverviewRailBase = (props: OverviewRailBaseProps) => {
    const activity = props.props.activity.map((item) => ({ item, iconProps: { icon: item.icon } }))
    return (
        <Stack gap="region">
            <SurfaceListCard
                label={props.props.agentsTitle}
                isLoading={props.props.isSkeleton}
                footer={
                    props.props.buyChatbotLabel === null ? undefined : (
                        <Button intent="neutral" size="sm" href={props.props.buyChatbotHref}>
                            {props.props.buyChatbotLabel}
                        </Button>
                    )
                }
                empty={<EmptyNotice message={props.props.agentsEmpty} description={props.props.agentsEmptyBody} />}
            >
                {props.props.agents.map((agent) => (
                    <ListRow
                        key={agent.id}
                        leading={
                            <AgentMark
                                glyph={nivoIconSource(agent.glyph, "leading")}
                                label={agent.name}
                                src={agent.avatarUrl}
                                module={agent.module}
                            />
                        }
                        title={agent.name}
                        badges={
                            <Badge tone={agent.isActive ? "success" : "neutral"} isDot>
                                {agent.statusLabel}
                            </Badge>
                        }
                        actions={
                            <Button intent="neutral" size="sm" href={agent.chatHref}>
                                {props.props.chatLabel}
                            </Button>
                        }
                    />
                ))}
            </SurfaceListCard>
            <SurfaceListCard
                label={props.props.activityTitle}
                isLoading={props.props.isSkeleton}
                footer={
                    <TextAction href={props.props.viewAllHref} appearance="section">
                        {props.props.viewAllLabel}
                    </TextAction>
                }
                empty={<EmptyNotice message={props.props.activityEmpty} description={props.props.activityEmptyBody} />}
            >
                {activity.map(({ item, iconProps }) => (
                    <ListRow
                        key={item.id}
                        leading={<TileIcon props={iconProps} />}
                        title={item.href === null ? item.actor : <TextAction href={item.href}>{item.actor}</TextAction>}
                        description={item.summary}
                    >
                        <Text size="xs" tone="muted">
                            {item.timeLabel}
                        </Text>
                    </ListRow>
                ))}
            </SurfaceListCard>
        </Stack>
    )
}
