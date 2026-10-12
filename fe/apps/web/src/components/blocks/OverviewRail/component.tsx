import { Badge, Button, EmptyNotice, ListRow, SurfaceListCard, Text, TextAction } from "@starci/grammar/common"
import { AgentAvatar } from "@/components/avatar/PersonAvatar"
import { OnboardingChecklist } from "@/components/promo/OnboardingChecklist"
import type { OnboardingStep } from "@/features/promo/queries"
import type { ModuleKey } from "@/lib/modules-shared"
import { TileIcon, type IconName } from "@/ui"
import { RAIL_CLASS_NAME } from "./classNames"

/** One agent row. */
interface OverviewRailAgent {
    readonly id: string
    readonly module: ModuleKey
    readonly name: string
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
        readonly steps: ReadonlyArray<OnboardingStep>
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
    }
}

/** The rail beside the open work: onboarding progress, the agents and the recent activity. */
export const OverviewRailBase = (props: OverviewRailBaseProps) => {
    const activity = props.props.activity.map((item) => ({ item, iconProps: { icon: item.icon } }))
    return (
        <div className={RAIL_CLASS_NAME}>
            <OnboardingChecklist steps={props.props.steps} />
            <SurfaceListCard
                label={props.props.agentsTitle}
                footer={
                    props.props.buyChatbotLabel === null ? undefined : (
                        <Button variant="secondary" size="sm" href={props.props.buyChatbotHref}>
                            {props.props.buyChatbotLabel}
                        </Button>
                    )
                }
                empty={<EmptyNotice message={props.props.agentsEmpty} description={props.props.agentsEmptyBody} />}
            >
                {props.props.agents.map((agent) => (
                    <ListRow
                        key={agent.id}
                        leading={<AgentAvatar module={agent.module} label={agent.name} online={agent.isActive} />}
                        title={agent.name}
                        badges={
                            <Badge tone={agent.isActive ? "success" : "neutral"} isDot>
                                {agent.statusLabel}
                            </Badge>
                        }
                        actions={
                            <Button variant="ghost" size="sm" href={agent.chatHref}>
                                {props.props.chatLabel}
                            </Button>
                        }
                    />
                ))}
            </SurfaceListCard>
            <SurfaceListCard
                label={props.props.activityTitle}
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
        </div>
    )
}
