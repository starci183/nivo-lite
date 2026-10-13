import {
    Badge,
    Breadcrumbs,
    Heading,
    IconTile,
    Image,
    NavLandmark,
    PageContainer,
    PrimaryRailLayout,
    Text,
    TextAction,
} from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { AgentTabs } from "@/components/blocks/AgentTabs"
import { nivoIconSource } from "@/components/leaves/Icon"
import { HEAD, HEADER, HEADER_COPY, HEADER_META, HEADER_TITLE, MAIN, RAIL, RAIL_COPY, RAIL_HEAD } from "./classNames"

type Tone = "neutral" | "accent" | "success" | "warning" | "danger"

/** One agent of the switcher on the left. */
interface AgentInstanceRailItem {
    readonly id: string
    readonly href: string
    readonly name: string
    readonly mascot: string
    readonly isCurrent: boolean
    readonly statusLabel: string
    readonly statusTone: Tone
}

/** Copy and state of the frame of an agent instance. */
export interface AgentInstanceLayoutBaseProps {
    readonly props: {
        readonly navLabel: string
        readonly allAgentsLabel: string
        readonly allAgentsHref: string
        readonly rail: ReadonlyArray<AgentInstanceRailItem>
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly mascot: string
        readonly title: string
        readonly isEarly: boolean
        readonly earlyLabel: string
        readonly statusLabel: string
        readonly statusTone: Tone
        /** The type name under an instance heading; null for a single instance agent. */
        readonly typeLine: string | null
        readonly versionLabel: string
        readonly liveLabel: string
        readonly tabsLabel: string
        readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href: string }>
        /** The facts of the agent are not known yet: name, statuses, version and live state are skeletons. */
        readonly isLoading: boolean
    }
    /** The routed tab drawn inside the frame. */
    readonly children?: ReactNode
}

const mascotOf = (mascot: string) => <Image src={mascot} alt="" aspect="square" fit="contain" plate="none" />

/** Draws the frame of an agent instance: the installed agents on the left, its header and tabs, and the routed tab below. */
export const AgentInstanceLayoutBase = (props: AgentInstanceLayoutBaseProps) => (
    <PageContainer measure="product">
        <PrimaryRailLayout
            railPosition="leading"
            railWidth="compact"
            align="start"
            collapsedOrder="rail-first"
            rail={
                <NavLandmark label={props.props.navLabel} layout="scrolling" className={RAIL}>
                    <div className={RAIL_HEAD}>
                        <TextAction href={props.props.allAgentsHref} size="sm" appearance="muted">
                            {props.props.allAgentsLabel}
                        </TextAction>
                    </div>
                    {props.props.rail.map((item) => (
                        <TextAction
                            key={item.id}
                            href={item.href}
                            appearance="route"
                            isCurrent={item.isCurrent}
                            startContent={
                                <IconTile source={nivoIconSource("apps", "leading")} artwork={mascotOf(item.mascot)} />
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
            }
            primary={
                <div className={MAIN}>
                    <div className={HEAD}>
                        <Breadcrumbs label={props.props.crumbLabel} items={props.props.crumbs} />
                    </div>
                    <div className={HEADER}>
                        <IconTile
                            size="md"
                            source={nivoIconSource("apps", "leading")}
                            artwork={mascotOf(props.props.mascot)}
                        />
                        <div className={HEADER_COPY}>
                            <div className={HEADER_TITLE}>
                                <Heading level={1} isSkeleton={props.props.isLoading}>
                                    {props.props.title}
                                </Heading>
                                {props.props.isEarly ? <Badge tone="accent">{props.props.earlyLabel}</Badge> : null}
                                <Badge isDot isSkeleton={props.props.isLoading} tone={props.props.statusTone}>
                                    {props.props.statusLabel}
                                </Badge>
                            </div>
                            <div className={HEADER_META}>
                                {props.props.typeLine === null ? null : (
                                    <Text size="sm" tone="muted">
                                        {props.props.typeLine}
                                    </Text>
                                )}
                                <Text size="sm" tone="muted" isSkeleton={props.props.isLoading}>
                                    {props.props.versionLabel}
                                </Text>
                                <Text size="sm" tone="muted" isSkeleton={props.props.isLoading}>
                                    {props.props.liveLabel}
                                </Text>
                            </div>
                        </div>
                    </div>
                    <AgentTabs label={props.props.tabsLabel} tabs={props.props.tabs} />
                    {props.children}
                </div>
            }
        />
    </PageContainer>
)
