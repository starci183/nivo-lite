import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { GuideBubble } from "@/features/overlays/assistant"
import { ActiveWorkspaceSync } from "@/components/blocks/ActiveWorkspaceSync"
import { MemberProvider } from "@/components/blocks/MemberProvider"
import type { ShellMember } from "@/hooks/member"
import { drainAfter, engineCtx } from "@/lib/flow-ctx"
import type { ConsoleWorkspace } from "@/modules/types"
import { ConsoleLayoutBase } from "./component"

/** What the console route hands the layout: the signed-in facts and the routed page. */
type ConsoleLayoutProps = {
    readonly workspaceName: string
    readonly userName: string
    readonly email: string
    readonly avatarUrl: string | null
    readonly member: ShellMember
    readonly workspaces: ReadonlyArray<ConsoleWorkspace>
    readonly currentWorkspaceId: string
    readonly children: ReactNode
}

/** The authenticated console frame: draws the chrome around the routed page; its connected blocks read the real counts from the back end GraphQL API. */
export const ConsoleLayout = async (props: ConsoleLayoutProps) => {
    const t = await getTranslations("shell")
    // Chain steps queued by the flow engine are drained after the response, once per request.
    drainAfter(await engineCtx())
    return (
        <MemberProvider member={props.member}>
            <ActiveWorkspaceSync workspaceId={props.currentWorkspaceId} />
            <ConsoleLayoutBase
                props={{
                    workspaceName: props.workspaceName,
                    userName: props.userName,
                    email: props.email,
                    avatarUrl: props.avatarUrl,
                    role: props.member.role,
                    workspaces: props.workspaces,
                    currentWorkspaceId: props.currentWorkspaceId,
                    mainNavigationLabel: t("mainNavigation"),
                    workspaceLabel: t("groupWorkspace"),
                }}
            >
                {props.children}
                <GuideBubble isManager={props.member.role !== "staff"} />
            </ConsoleLayoutBase>
        </MemberProvider>
    )
}
