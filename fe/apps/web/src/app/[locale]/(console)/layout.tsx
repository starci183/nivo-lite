import type { ReactNode } from "react"
import { ConsoleLayout } from "@/features/layouts/ConsoleLayout"
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
                workspaceId: session.workspace.id,
                userId: session.member.userId,
                name: session.member.displayName,
                role: session.member.role,
                staffId: session.member.staffId,
            }}
            workspaces={session.workspaces}
            currentWorkspaceId={session.workspace.id}
        >
            {children}
        </ConsoleLayout>
    )
}

export default Layout
