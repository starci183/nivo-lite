import { Badge, Breadcrumbs, Button, Heading, IconTile, Image, Text } from "@starci/grammar/common"
import type { BadgeTone, BreadcrumbItem } from "@starci/grammar/common"
import { ConnectionNeeds, type ConnectionNeedsProps } from "@/components/leaves/ConnectionNeeds"
import { nivoIconSource } from "@/components/leaves/Icon"
import { HEAD, HEADER, HEADER_COPY, HEADER_META, HEADER_TITLE } from "./classNames"

/** Copy and state of the header of an agent instance. */
export interface AgentInstanceHeaderBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly mascot: string
        readonly title: string
        readonly isEarly: boolean
        readonly earlyLabel: string
        readonly statusLabel: string
        readonly statusTone: BadgeTone
        /** What a `needs_connection` agent waits for and where to connect it; no lines otherwise. */
        readonly needs: ConnectionNeedsProps
        /** The type name under an instance heading; null for a single instance agent. */
        readonly typeLine: string | null
        readonly versionLabel: string
        readonly liveLabel: string
        /** Where the profile of the agent that drives this instance lives; null while the instance has no agent. */
        readonly profileHref: string | null
        readonly profileLabel: string
        /** The facts of the agent are not known yet: statuses, version and live state are skeletons. */
        readonly isLoading: boolean
    }
}

/** Draws the trail and the header of an agent instance: mascot, name, statuses, version and live state. */
export const AgentInstanceHeaderBase = (props: AgentInstanceHeaderBaseProps) => {
    const view = props.props
    return (
        <>
            <div className={HEAD}>
                <Breadcrumbs label={view.crumbLabel} items={view.crumbs} />
            </div>
            <div className={HEADER}>
                <IconTile
                    size="md"
                    source={nivoIconSource("apps", "leading")}
                    artwork={<Image src={view.mascot} alt="" aspect="square" fit="contain" plate="none" />}
                />
                <div className={HEADER_COPY}>
                    <div className={HEADER_TITLE}>
                        <Heading level={1} isSkeleton={view.isLoading}>
                            {view.title}
                        </Heading>
                        {view.isEarly ? <Badge tone="accent">{view.earlyLabel}</Badge> : null}
                        <Badge isDot isSkeleton={view.isLoading} tone={view.statusTone}>
                            {view.statusLabel}
                        </Badge>
                    </div>
                    <div className={HEADER_META}>
                        {view.typeLine === null ? null : (
                            <Text size="sm" tone="muted">
                                {view.typeLine}
                            </Text>
                        )}
                        <Text size="sm" tone="muted" isSkeleton={view.isLoading}>
                            {view.versionLabel}
                        </Text>
                        <Text size="sm" tone="muted" isSkeleton={view.isLoading}>
                            {view.liveLabel}
                        </Text>
                    </div>
                    <ConnectionNeeds {...view.needs} />
                    {view.profileHref === null ? null : (
                        <Button size="sm" intent="neutral" href={view.profileHref}>
                            {view.profileLabel}
                        </Button>
                    )}
                </div>
            </div>
        </>
    )
}
