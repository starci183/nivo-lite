import { nivoIconSource, type IconName } from "@/components/leaves/Icon"
import { Button, EmptyNotice, Link, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
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

/** One agent row as list data: its mark, its standing and the chat it opens. */
const agentItemOf = (agent: OverviewRailAgent, chatLabel: string): ListRowData => ({
    id: agent.id,
    title: agent.name,
    leading: {
        avatar: {
            name: agent.name,
            kind: "agent",
            seed: agent.id,
            // The mark of an agent without its own picture is the NIVO unicorn, as AgentMark draws it.
            src: agent.avatarUrl ?? "/images/agents/mascot-avatar.webp",
        },
    },
    badges: [{ label: agent.statusLabel, tone: agent.isActive ? "success" : "neutral", isDot: true }],
    action: { label: chatLabel, href: agent.chatHref },
})

/** One recent-activity row as list data: its glyph, who acted and when, and where it leads. */
const activityItemOf = (item: OverviewRailActivity): ListRowData => ({
    id: item.id,
    title: item.actor,
    leading: { icon: nivoIconSource(item.icon, "leading") },
    description: item.summary,
    ...(item.href === null ? {} : { href: item.href }),
    detail: (
        <Text size="xs" tone="muted">
            {item.timeLabel}
        </Text>
    ),
})

/** The rail beside the open work: onboarding progress, the agents and the recent activity. */
export const OverviewRailBase = (props: OverviewRailBaseProps) => (
    <Stack gap="region">
        <SurfaceCard
            kind="list"
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
            items={props.props.agents.map((agent) => agentItemOf(agent, props.props.chatLabel))}
        />
        <SurfaceCard
            kind="list"
            label={props.props.activityTitle}
            isLoading={props.props.isSkeleton}
            footer={<Link href={props.props.viewAllHref}>{props.props.viewAllLabel}</Link>}
            empty={<EmptyNotice message={props.props.activityEmpty} description={props.props.activityEmptyBody} />}
            items={props.props.activity.map(activityItemOf)}
        />
    </Stack>
)
