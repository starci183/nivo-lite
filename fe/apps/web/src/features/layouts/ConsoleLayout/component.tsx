import { WorkspaceShell } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { ConsoleCompactNavigation } from "@/components/blocks/ConsoleCompactNavigation"
import { ConsoleHeader } from "@/components/blocks/ConsoleHeader"
import { ConsoleNavigation } from "@/components/blocks/ConsoleNavigation"
import type { ConsolePending, ConsoleWorkspace } from "@/modules/types"

/** The session facts, real counts and words the console frame draws, resolved by the layout. */
export interface ConsoleLayoutBaseProps {
    readonly props: {
        readonly workspaceName: string
        readonly userName: string
        readonly email: string
        readonly avatarUrl: string | null
        readonly role: "owner" | "manager" | "staff"
        readonly workspaces: ReadonlyArray<ConsoleWorkspace>
        readonly currentWorkspaceId: string
        readonly pending: ReadonlyArray<ConsolePending>
        readonly pendingCount: number
        readonly chatbotAgentId: string | null
        readonly isFoundingMember: boolean
        readonly mainNavigationLabel: string
        readonly workspaceLabel: string
    }
    readonly children: ReactNode
}

/** Draws the authenticated console frame: sticky top bar, wide rail, compact navigation and the routed page. */
export const ConsoleLayoutBase = (props: ConsoleLayoutBaseProps) => (
    <WorkspaceShell
        align="stretch"
        header={
            <ConsoleHeader
                workspaceName={props.props.workspaceName}
                userName={props.props.userName}
                email={props.props.email}
                avatarUrl={props.props.avatarUrl}
                role={props.props.role}
                workspaces={props.props.workspaces}
                currentWorkspaceId={props.props.currentWorkspaceId}
                pending={props.props.pending}
                pendingCount={props.props.pendingCount}
                chatbotAgentId={props.props.chatbotAgentId}
                isFoundingMember={props.props.isFoundingMember}
            />
        }
        navigation={<ConsoleNavigation role={props.props.role} pendingCount={props.props.pendingCount} />}
        navigationLabel={props.props.mainNavigationLabel}
        navigationTrack="intrinsic"
        navigationVisibility="wide"
        compactNavigation={<ConsoleCompactNavigation role={props.props.role} pendingCount={props.props.pendingCount} />}
        compactNavigationLabel={props.props.mainNavigationLabel}
        primaryLabel={props.props.workspaceLabel}
        primary={props.children}
    />
)
