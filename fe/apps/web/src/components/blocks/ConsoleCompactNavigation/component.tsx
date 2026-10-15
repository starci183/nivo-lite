import { Badge, Button, Drawer, Icon, TextAction } from "@starci/grammar/common"
import type { ConsoleNavItem } from "@/modules/types"
import { ConsoleSidebar } from "../../composites/ConsoleSidebar"
import { nivoIconSource } from "@/components/leaves/Icon"
import { COMPACT_NAV } from "./classNames"

/** The destinations, words and open state, resolved by the connected block. */
export interface ConsoleCompactNavigationBaseProps {
    readonly props: {
        readonly tabs: ReadonlyArray<ConsoleNavItem>
        readonly more: ReadonlyArray<ConsoleNavItem>
        readonly moreLabel: string
        readonly groupLabels: { readonly operate: string; readonly setup: string }
        readonly isMoreOpen: boolean
    }
    readonly on: {
        readonly go: (href: string) => void
        readonly setMoreOpen: (isOpen: boolean) => void
    }
}

/** Draws the compact bar: the first destinations as route actions, the rest in a drawer sidebar behind "More". */
export const ConsoleCompactNavigationBase = (props: ConsoleCompactNavigationBaseProps) => (
    <div className={COMPACT_NAV}>
        {props.props.tabs.map((item) => (
            <TextAction
                key={item.id}
                href={item.href}
                appearance="route"
                size="sm"
                isCurrent={item.isActive}
                endContent={item.badge > 0 ? <Badge tone="accent">{item.badge}</Badge> : undefined}
            >
                {item.label}
            </TextAction>
        ))}
        <Drawer
            isOpen={props.props.isMoreOpen}
            onOpenChange={props.on.setMoreOpen}
            placement="bottom"
            title={props.props.moreLabel}
            trigger={
                <Button
                    variant={props.props.more.some((item) => item.isActive) ? "secondary" : "ghost"}
                    size="sm"
                    startContent={<Icon source={nivoIconSource("apps", "leading")} usage="leading" />}
                >
                    {props.props.moreLabel}
                </Button>
            }
        >
            <ConsoleSidebar
                items={props.props.more}
                label={props.props.moreLabel}
                presentation="drawer"
                groupLabels={props.props.groupLabels}
                onGo={(href) => {
                    props.on.setMoreOpen(false)
                    props.on.go(href)
                }}
            />
        </Drawer>
    </div>
)
