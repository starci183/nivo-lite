import { Badge, Sidebar } from "@starci/grammar/common"
import type { SidebarGroup, SidebarItem } from "@starci/grammar/common"
import type { ConsoleNavItem } from "@/modules/types"
import { nivoIconSource } from "@/components/leaves/Icon"

/** What the navigation rail draws and reports. */
type ConsoleSidebarProps = {
    readonly items: ReadonlyArray<ConsoleNavItem>
    readonly label: string
    readonly presentation: "rail" | "drawer"
    readonly groupLabels: { readonly operate: string; readonly setup: string }
    readonly onGo: (href: string) => void
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

/** The grammar `Sidebar`: the wide rail owns item selection and its edge, the drawer variant lists the overflow. */
export const ConsoleSidebar = (props: ConsoleSidebarProps) => (
    <Sidebar
        label={props.label}
        presentation={props.presentation}
        groups={toGroups(props.items, props.groupLabels)}
        selectedKey={props.items.find((item) => item.isActive)?.id}
        onAction={(id) => {
            const target = props.items.find((item) => item.id === id)
            if (target) props.onGo(target.href)
        }}
    />
)
