import { EmptyNotice, Link, Section } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { IconName } from "@/components/leaves/Icon"
import { CONSOLE_ROUTES } from "@/modules/routes"
import type { OverviewPaneCopy, OverviewPaneReady } from "@/modules/types"

/** What the agents and activity sections draw. */
interface OverviewAsideListsProps {
    readonly data: OverviewPaneReady
    readonly copy: OverviewPaneCopy
    readonly onGo: (href: string) => void
    readonly isLoading: boolean
}

/** The glyph of each kind of activity; a kind that is not listed is a notification. */
const KIND_ICONS: Readonly<Record<string, IconName>> = {
    "lead.captured": "account",
    "context.summarised": "talents",
    "responsibility.assigned": "review",
    "execution.drafted": "send",
    "execution.approved": "complete",
    "execution.rejected": "close",
    "outcome.recorded": "saved",
    "agent.installed": "agentos",
    "agent.updated": "agentos",
}

/** The picture of an agent that has none of its own: the NIVO unicorn mascot. */
const MASCOT_SRC = "/images/agents/mascot-avatar.webp"

/** One agent: its mark, its name and its standing. */
const agentRowOf = (agent: OverviewPaneReady["agents"][number], onGo: (href: string) => void): ListRowData => ({
    id: agent.id,
    title: agent.name,
    onPress: () => onGo(agent.href),
    leading: { avatar: { name: agent.name, kind: "agent", seed: agent.id, src: agent.avatarUrl ?? MASCOT_SRC } },
    badges: [{ label: agent.statusLabel, tone: agent.isActive ? "success" : "neutral", isDot: true }],
})

/** One recent event: its glyph, who acted, what, and how long ago. */
const activityRowOf = (item: OverviewPaneReady["activity"][number], onGo: (href: string) => void): ListRowData => ({
    id: item.id,
    title: item.actor,
    description: item.summary,
    leading: { icon: nivoIconSource(KIND_ICONS[item.kind] ?? "notification", "leading") },
    ...(item.href === null ? {} : { onPress: () => onGo(item.href ?? "") }),
    meta: { text: item.time },
})

/** The agents and the latest activity: the foot of the side pane. */
export const OverviewAsideLists = (props: OverviewAsideListsProps) => (
    <>
        <Section
            kind="list"
            title={props.copy.agentsTitle}
            headingLevel={3}
            count={props.data.agents.length}
            isLoading={props.isLoading}
            empty={<EmptyNotice message={props.copy.agentsTitle} />}
            items={props.data.agents.map((agent) => agentRowOf(agent, props.onGo))}
        />
        <Section
            kind="list"
            title={props.copy.activityTitle}
            headingLevel={3}
            isLoading={props.isLoading}
            action={<Link href={CONSOLE_ROUTES.responsibilities}>{props.copy.activityAll}</Link>}
            empty={<EmptyNotice message={props.copy.activityTitle} />}
            items={props.data.activity.map((item) => activityRowOf(item, props.onGo))}
        />
    </>
)
