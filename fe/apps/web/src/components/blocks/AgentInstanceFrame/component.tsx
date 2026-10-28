import type { ReactNode } from "react"
import { Badge, Button, Divider, FillViewport, Page, SurfaceCard } from "@starci/grammar/common"
import type { BadgeTone, BreadcrumbItem } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { ConnectionNeeds, type ConnectionNeedsProps } from "@/components/leaves/ConnectionNeeds"
import { BODY, FRAME, HEADER_ACTIONS, MAIN, RAIL_COLUMN, SEPARATOR, SEPARATOR_VERTICAL } from "./classNames"

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

/** Copy, header view and tabs of the frame of an agent instance. */
export interface AgentInstanceFrameBaseProps {
    /** The installed agents rail and the routed tab. */
    readonly shape: { readonly rail: ReactNode; readonly body: ReactNode }
    readonly props: {
        readonly ariaLabel: string
        readonly earlyLabel: string
        readonly chatLabel: string
        readonly profileLabel: string
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly tabsLabel: string
        readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href: string }>
        /** The instance is not known yet: the header keeps its boxes. */
        readonly isSkeleton: boolean
        readonly view: InstanceHeaderView
    }
}

/** Draws the frame of an agent instance: one bleed `Page` whose band carries the trail, the avatar with the name and status, the facts line, the two actions and the instance link tabs, then one joined surface with the installed agents on the left and the routed tab. */
export const AgentInstanceFrameBase = (props: AgentInstanceFrameBaseProps) => {
    const copy = props.props
    const view = copy.view
    return (
        <Page
            chrome="bleed"
            measure="product"
            isSkeleton={copy.isSkeleton}
            header={{
                breadcrumbs: { label: copy.crumbLabel, items: copy.crumbs },
                mark: (
                    <AgentMark
                        label={view.name}
                        seed={view.seed}
                        src={view.avatarUrl}
                        size="control"
                        isSkeleton={copy.isSkeleton}
                    />
                ),
                title: view.name,
                status: (
                    <>
                        {view.isEarly ? <Badge tone="accent">{copy.earlyLabel}</Badge> : null}
                        <Badge isDot tone={view.statusTone}>
                            {view.statusLabel}
                        </Badge>
                    </>
                ),
                meta: view.subtitle,
                description: view.needs.lines.length === 0 ? undefined : <ConnectionNeeds {...view.needs} />,
                actions: (
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
                ),
                tabs: {
                    label: copy.tabsLabel,
                    labelVisibility: "always",
                    items: [...copy.tabs],
                },
            }}
        >
            <FillViewport minHeight="md" bottomInset="page">
                <SurfaceCard ariaLabel={copy.ariaLabel} composition="joined" height="fill">
                    <div className={FRAME}>
                        <div className={RAIL_COLUMN}>{props.shape.rail}</div>
                        <div className={SEPARATOR}>
                            <Divider semantics="presentation" />
                        </div>
                        <div className={SEPARATOR_VERTICAL}>
                            <Divider orientation="vertical" semantics="presentation" />
                        </div>
                        <div className={MAIN}>
                            <div className={BODY}>{props.shape.body}</div>
                        </div>
                    </div>
                </SurfaceCard>
            </FillViewport>
        </Page>
    )
}
