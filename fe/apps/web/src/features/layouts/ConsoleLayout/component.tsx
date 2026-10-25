import { WorkspaceShell } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { ConsoleHeader } from "@/components/blocks/ConsoleHeader"
import { ConsoleDrawerContent } from "@/components/blocks/ConsoleDrawerContent"
import { ConsoleNavigation } from "@/components/blocks/ConsoleNavigation"
import { GuideBubble } from "@/components/blocks/GuideBubble"
import { ConsoleDrawerIcon } from "@/components/leaves/Icon"

/** The words the console frame draws, resolved by the server layout (the real counts are read by the connected blocks). */
export interface ConsoleLayoutBaseProps {
    readonly props: {
        readonly mainNavigationLabel: string
        readonly workspaceLabel: string
        readonly drawer: {
            readonly title: string
            readonly openLabel: string
            readonly closeLabel: string
        }
    }
    readonly children: ReactNode
}

/** Draws the authenticated console frame with Grammar owning its compact navigation drawer. */
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
            source: ConsoleDrawerIcon,
            defaultOpen: false,
            content: <ConsoleDrawerContent />,
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
