import type { ConsoleNavItem } from "@/modules/types"
import { ConsoleSidebar } from "../../composites/ConsoleSidebar"

/** The rail destinations and words, resolved by the connected block. */
export interface ConsoleNavigationBaseProps {
    readonly props: {
        readonly items: ReadonlyArray<ConsoleNavItem>
        readonly label: string
        readonly groupLabels: { readonly operate: string; readonly setup: string }
    }
    readonly on: { readonly go: (href: string) => void }
}

/** Draws the wide navigation rail from resolved destinations. */
export const ConsoleNavigationBase = (props: ConsoleNavigationBaseProps) => (
    <ConsoleSidebar
        items={props.props.items}
        label={props.props.label}
        presentation="rail"
        groupLabels={props.props.groupLabels}
        onGo={props.on.go}
    />
)
