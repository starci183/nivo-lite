import { WorkspaceShell } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { ConsoleHeader } from "@/components/blocks/ConsoleHeader"
import { ConsoleDrawerContent } from "@/components/blocks/ConsoleDrawerContent"
import { ConsoleNavigation } from "@/components/blocks/ConsoleNavigation"
import { GuideBubble } from "@/components/blocks/GuideBubble"
import { nivoIconSource } from "@/components/leaves/Icon"

/** The words and state the console frame draws, resolved by the connected layout (the real counts are read by the connected blocks). */
export interface ConsoleLayoutBaseProps {
    readonly props: {
        readonly mainNavigationLabel: string
        readonly workspaceLabel: string
        readonly drawer: {
            readonly title: string
            readonly openLabel: string
            readonly closeLabel: string
            readonly isOpen: boolean
        }
    }
    readonly on: { readonly setDrawerOpen: (isOpen: boolean) => void }
    readonly children: ReactNode
}

/** Draws the authenticated console frame: a fixed-viewport shell with the top bar, the wide rail and the routed page each in their own place; on a phone a row under the bar opens the same rail as a drawer. */
export const ConsoleLayoutBase = (props: ConsoleLayoutBaseProps) => (
    <WorkspaceShell
        viewport="fixed"
        align="stretch"
        header={<ConsoleHeader />}
        headerLandmark="slot"
        navigation={<ConsoleNavigation />}
        navigationLabel={props.props.mainNavigationLabel}
        navigationTrack="intrinsic"
        navigationVisibility="wide"
        navigationDrawer={{
            title: props.props.drawer.title,
            openLabel: props.props.drawer.openLabel,
            closeLabel: props.props.drawer.closeLabel,
            source: nivoIconSource("more", "leading"),
            isOpen: props.props.drawer.isOpen,
            onOpenChange: props.on.setDrawerOpen,
            content: <ConsoleDrawerContent onNavigate={() => props.on.setDrawerOpen(false)} />,
        }}
        primaryLabel={props.props.workspaceLabel}
        primary={
            <>
                {props.children}
                <GuideBubble />
            </>
        }
    />
)
