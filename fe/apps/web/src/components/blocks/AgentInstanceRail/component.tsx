import { Badge, Button, Divider, Icon, ListBox, NavLandmark, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { nivoIconSource } from "@/components/leaves/Icon"
import { RAIL, RAIL_FOOT, RAIL_HEAD, RAIL_LIST } from "./classNames"

/** One agent of the switcher on the left. */
export interface AgentInstanceRailItem {
    readonly id: string
    readonly name: string
    readonly seed: string
    readonly avatarUrl: string | null
    readonly roleName: string
    readonly isCurrent: boolean
    readonly statusLabel: string
    readonly statusTone: BadgeTone
}

/** Copy and state of the switcher of the installed agents. */
export interface AgentInstanceRailBaseProps {
    readonly props: {
        readonly navLabel: string
        readonly title: string
        readonly addLabel: string
        readonly addHref: string
        readonly items: ReadonlyArray<AgentInstanceRailItem>
        /** The agents are not known yet: the list draws waiting rows. */
        readonly isLoading: boolean
    }
    readonly on: { readonly open: (id: string) => void }
}

/** Draws the installed agents (one row per instance, the open one filled) with the way to add another. */
export const AgentInstanceRailBase = (props: AgentInstanceRailBaseProps) => (
    <NavLandmark label={props.props.navLabel} layout="scrolling" className={RAIL}>
        <div className={RAIL_HEAD}>
            <Text weight="semibold">{props.props.title}</Text>
        </div>
        <Divider semantics="presentation" />
        <div className={RAIL_LIST}>
            <ListBox
                label={props.props.title}
                selectionMode="single"
                selectionIndicator="none"
                isLoading={props.props.isLoading}
                loadingRows={3}
                selectedIds={props.props.items.filter((item) => item.isCurrent).map((item) => item.id)}
                onSelectionChange={(ids) => {
                    const picked = ids[0]
                    if (picked !== undefined) props.on.open(picked)
                }}
                items={props.props.items.map((item) => ({
                    id: item.id,
                    label: item.name,
                    description: `${item.roleName} · ${item.statusLabel}`,
                    leading: <AgentMark label={item.name} seed={item.seed} src={item.avatarUrl} size="md" />,
                    trailing: <Badge isDot tone={item.statusTone} />,
                }))}
            />
        </div>
        <Divider semantics="presentation" />
        <div className={RAIL_FOOT}>
            <Button
                intent="neutral"
                width="fill"
                href={props.props.addHref}
                startContent={<Icon source={nivoIconSource("add", "leading")} usage="leading" />}
            >
                {props.props.addLabel}
            </Button>
        </div>
    </NavLandmark>
)
