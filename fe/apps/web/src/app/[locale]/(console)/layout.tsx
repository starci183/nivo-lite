import type { ReactNode } from "react"
import { GuideBubble } from "@/features/overlays/assistant"
import { ConsoleLayout } from "@/features/layouts/ConsoleLayout"
import { isManagerRole } from "@/lib/members-shared"
import { getSession } from "@/lib/session"

type LayoutProps = { readonly children: ReactNode }

/** Authenticated console route: reads the session and mounts the console layout around the routed page and the guide. */
const Layout = async ({ children }: LayoutProps) => {
    const session = await getSession()
    return (
        <ConsoleLayout
            workspaceName={session.workspace.name}
            userName={session.userName}
            email={session.email}
            avatarUrl={session.avatarUrl}
            member={{
                userId: session.member.userId,
                name: session.member.displayName,
                role: session.member.role,
                staffId: session.member.staffId,
            }}
            workspaces={session.workspaces}
            currentWorkspaceId={session.workspace.id}
        >
            {children}
            <GuideBubble isManager={isManagerRole(session.member.role)} />
        </ConsoleLayout>
    )
}

export default Layout
