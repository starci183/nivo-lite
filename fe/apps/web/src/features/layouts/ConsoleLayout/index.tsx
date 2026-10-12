import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { MemberProvider } from "@/components/blocks/MemberProvider"
import type { ShellMember } from "@/hooks/member"
import { drainAfter, engineCtx } from "@/lib/flow-ctx"
import { FOUNDING_OFFER } from "@/lib/promo"
import { readShell } from "@/modules/db"
import type { ShellApproval, ShellException } from "@/modules/db"
import type { ConsolePending, ConsoleWorkspace } from "@/modules/types"
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

const SUMMARY_MAX = 60

const LEADS_ROUTE = "/leads"

const OFFICE_ROUTE = "/chat"

const clip = (value: string): string =>
    value.length > SUMMARY_MAX ? `${value.slice(0, SUMMARY_MAX - 1).trimEnd()}…` : value

const approvalHref = (approval: ShellApproval): string =>
    approval.leadId === null ? LEADS_ROUTE : `${LEADS_ROUTE}/${approval.leadId}`

/** The authenticated console frame: reads the real counts under the caller RLS and draws the chrome around the routed page. */
export const ConsoleLayout = async (props: ConsoleLayoutProps) => {
    const t = await getTranslations("shell")
    const outcome = await readShell(props.currentWorkspaceId, {
        from: FOUNDING_OFFER.startsAt,
        to: FOUNDING_OFFER.endsAt,
    })
    // Chain steps queued by the flow engine are drained after the response, once per request.
    drainAfter(await engineCtx())
    if (outcome.kind !== "ok") throw new Error(`shell: ${outcome.kind} ${outcome.code}`)
    const facts = outcome.value
    const approvals: ReadonlyArray<ConsolePending> = facts.approvals.map((approval: ShellApproval) => ({
        id: approval.id,
        leadName: approval.contactName ?? t("unknownLead"),
        summary: clip(approval.nextAction || approval.draft),
        href: approvalHref(approval),
    }))
    // Exceptions with no approval card of their own (an approval card is already in the list above).
    const exceptions: ReadonlyArray<ConsolePending> = facts.exceptions.map((item: ShellException) => ({
        id: `wi-${item.id}`,
        leadName: item.contactName ?? t("unknownLead"),
        summary: clip(item.summary || item.error || ""),
        href: OFFICE_ROUTE,
    }))
    return (
        <MemberProvider member={props.member}>
            <ConsoleLayoutBase
                props={{
                    workspaceName: props.workspaceName,
                    userName: props.userName,
                    email: props.email,
                    avatarUrl: props.avatarUrl,
                    role: props.member.role,
                    workspaces: props.workspaces,
                    currentWorkspaceId: props.currentWorkspaceId,
                    pending: [...approvals, ...exceptions],
                    pendingCount: facts.pendingDecisions,
                    chatbotAgentId: facts.agents.find((agent) => agent.module === "chatbot")?.id ?? null,
                    isFoundingMember: facts.isFoundingMember,
                    mainNavigationLabel: t("mainNavigation"),
                    workspaceLabel: t("groupWorkspace"),
                }}
            >
                {props.children}
            </ConsoleLayoutBase>
        </MemberProvider>
    )
}
