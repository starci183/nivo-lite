import { WorkspaceShell } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { ConsoleCompactNavigation } from "@/components/blocks/ConsoleCompactNavigation"
import { ConsoleHeader } from "@/components/blocks/ConsoleHeader"
import { ConsoleNavigation } from "@/components/blocks/ConsoleNavigation"
import { GuideBubble } from "@/components/blocks/GuideBubble"

/** The session facts and words the console frame draws, resolved by the layout (the real counts are read by the connected blocks). */
export interface ConsoleLayoutBaseProps {
    readonly props: {
        readonly mainNavigationLabel: string
        readonly workspaceLabel: string
    }
    readonly children: ReactNode
}

/** Draws the authenticated console frame: sticky top bar, wide rail, compact navigation and the routed page. */
export const ConsoleLayoutBase = (props: ConsoleLayoutBaseProps) => (
    <WorkspaceShell
        align="stretch"
        header={<ConsoleHeader />}
        navigation={<ConsoleNavigation />}
        navigationLabel={props.props.mainNavigationLabel}
        navigationTrack="intrinsic"
        navigationVisibility="wide"
        compactNavigation={<ConsoleCompactNavigation />}
        compactNavigationLabel={props.props.mainNavigationLabel}
        primaryLabel={props.props.workspaceLabel}
        primary={
            <>
                {props.children}
                <GuideBubble />
            </>
        }
    />
)
