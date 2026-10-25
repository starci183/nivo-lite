import { Badge, Sidebar } from "@starci/grammar/common"
import type { SidebarGroup, SidebarItem } from "@starci/grammar/common"
import type { ReactNode } from "react"
import type { ConsoleNavItem } from "@/modules/types"
import { nivoIconSource } from "@/components/leaves/Icon"

/** What the navigation rail draws and reports. */
type ConsoleSidebarProps = {
    readonly items: ReadonlyArray<ConsoleNavItem>
    readonly label: string
    readonly presentation: "rail" | "drawer"
    readonly groupLabels: { readonly operate: string; readonly setup: string }
    readonly onGo: (href: string) => void
    /** Above the groups (the drawer puts its language and appearance controls there). */
    readonly header?: ReactNode
    /** Below the groups. */
    readonly footer?: ReactNode
    /** Collapse command and words; the drawer never collapses, so it passes none. */
    readonly collapse?: {
        readonly isCollapsed: boolean
        readonly collapseLabel: string
        readonly expandLabel: string
        readonly onChange: (collapsed: boolean) => void
    }
}

const GROUP_ORDER = ["work", "operate", "setup"] as const

/** Office carries the real pending count as the item trailing badge. */
const toSidebarItem = (item: ConsoleNavItem): SidebarItem => ({
    id: item.id,
    label: item.label,
    source: nivoIconSource(item.icon, "leading"),
    trailing: item.badge > 0 ? <Badge tone="accent">{item.badge}</Badge> : undefined,
})

/** The rail sections in order, empty ones dropped; the daily-work section carries no heading. */
const toGroups = (
    items: ReadonlyArray<ConsoleNavItem>,
    labels: ConsoleSidebarProps["groupLabels"],
): ReadonlyArray<SidebarGroup> =>
    GROUP_ORDER.map((group) => ({
        id: group,
        ...(group === "work" ? {} : { label: labels[group] }),
        items: items.filter((item) => item.group === group).map(toSidebarItem),
    })).filter((group) => group.items.length > 0)

/** The selection prop of the active item, absent while none is active. */
const selectedKeyOf = (items: ReadonlyArray<ConsoleNavItem>): { readonly selectedKey?: string } => {
    const active = items.find((item) => item.isActive)
    return active === undefined ? {} : { selectedKey: active.id }
}

/** The grammar `Sidebar`: the wide rail owns item selection and its edge, the drawer variant lists the overflow. */
export const ConsoleSidebar = (props: ConsoleSidebarProps) => (
    <Sidebar
        label={props.label}
        presentation={props.presentation}
        groups={toGroups(props.items, props.groupLabels)}
        {...(props.header === undefined ? {} : { header: props.header })}
        {...(props.footer === undefined ? {} : { footer: props.footer })}
        {...selectedKeyOf(props.items)}
        {...(props.collapse === undefined
            ? {}
            : {
                  isCollapsed: props.collapse.isCollapsed,
                  collapseLabel: props.collapse.collapseLabel,
                  expandLabel: props.collapse.expandLabel,
                  toggleSource: nivoIconSource("collapseRail", "leading"),
                  onCollapsedChange: props.collapse.onChange,
              })}
        onAction={(id) => {
            const target = props.items.find((item) => item.id === id)
            if (target) props.onGo(target.href)
        }}
    />
)
