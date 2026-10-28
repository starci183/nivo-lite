import { Badge, Button, PageHeader } from "@starci/grammar/common"
import type { BadgeTone, BreadcrumbItem } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { AgentMark } from "@/components/leaves/AgentMark"
import { ConnectionNeeds, type ConnectionNeedsProps } from "@/components/leaves/ConnectionNeeds"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { HEADER_ACTIONS } from "./classNames"

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
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly tabsLabel: string
        readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly selectedTab: string
        readonly slot: DataSlot<InstanceHeaderView>
        readonly placeholder: InstanceHeaderView
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly selectTab: (id: string) => void }
}

/** Draws the page header of an agent instance: the trail, the avatar with the name and status, the facts line, the two actions and the instance tabs on the separator. */
export const AgentInstanceHeaderBase = (props: AgentInstanceHeaderBaseProps) => {
    const copy = props.props
    return (
        <SlotView slot={copy.slot} placeholder={copy.placeholder} labels={copy.slotLabels}>
            {(view, isSkeleton) => (
                <PageHeader
                    measure="product"
                    isSkeleton={isSkeleton}
                    breadcrumbs={{ label: copy.crumbLabel, items: copy.crumbs }}
                    mark={
                        <AgentMark
                            label={view.name}
                            seed={view.seed}
                            src={view.avatarUrl}
                            size="control"
                            isSkeleton={isSkeleton}
                        />
                    }
                    title={view.name}
                    status={
                        <>
                            {view.isEarly ? <Badge tone="accent">{copy.earlyLabel}</Badge> : null}
                            <Badge isDot tone={view.statusTone}>
                                {view.statusLabel}
                            </Badge>
                        </>
                    }
                    meta={view.subtitle}
                    description={view.needs.lines.length === 0 ? undefined : <ConnectionNeeds {...view.needs} />}
                    actions={
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
                    }
                    tabs={{
                        label: copy.tabsLabel,
                        selectedKey: copy.selectedTab,
                        labelVisibility: "always",
                        items: copy.tabs,
                        onSelect: props.on.selectTab,
                    }}
                />
            )}
        </SlotView>
    )
}
