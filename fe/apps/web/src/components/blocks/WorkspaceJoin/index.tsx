"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { inviteViewOf, useAcceptInvite, useInviteView, type InviteView } from "@/hooks/invite"
import { inviteTokenOf } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES, invitePath, workspaceHref } from "@/modules/routes"
import { WorkspaceJoinBase, type WorkspaceJoinPreview } from "./component"

/** The account note: the invitation is for this account, for another one, or the visitor is signed out. */
const noteOf = (view: InviteView, t: ReturnType<typeof useTranslations<"onboarding">>): string => {
    if (view.visitor === "ready") return t("joinForYou", { email: view.forEmail })
    return view.visitor === "mismatch" ? view.mismatchBody : view.signedOutHint
}

/** Why the pasted text cannot be used: its title and line (not a link, or a link that no longer works); nothing while it is empty or usable. */
const errorOf = (
    value: string,
    token: string | null,
    view: InviteView | undefined,
    t: ReturnType<typeof useTranslations<"onboarding">>,
): { readonly title: string; readonly body: string } | undefined => {
    if (value.trim() === "") return undefined
    if (token === null) return { title: t("errGeneric"), body: t("errLink") }
    return view?.visitor === "unavailable" ? { title: view.title, body: view.body } : undefined
}

/** The preview of a usable invitation, or nothing while it reads or when it cannot be used. */
const previewOf = (
    view: InviteView | undefined,
    token: string,
    isAccepting: boolean,
    t: ReturnType<typeof useTranslations<"onboarding">>,
): WorkspaceJoinPreview | undefined => {
    if (view === undefined || view.visitor === "unavailable") return undefined
    const ready = view.visitor === "ready"
    return {
        workspaceName: view.workspaceName,
        line: view.body,
        note: noteOf(view, t),
        actionLabel: ready ? view.title : t("joinOpenInvite"),
        action: ready ? "join" : "open",
        openHref: invitePath(token),
        isAccepting,
    }
}

/** The connected join form: a pasted invitation link previews its workspace in place, and joins it when it is for this account. */
export const WorkspaceJoin = () => {
    const t = useTranslations("onboarding")
    const router = navigation.useRouter()
    const [value, setValue] = useState("")
    const token = inviteTokenOf(value)
    const read = useInviteView(token ?? "", token !== null)
    const view = inviteViewOf(read)
    const { accept, isAccepting } = useAcceptInvite()
    const error = errorOf(value, token, view, t)
    return (
        <WorkspaceJoinBase
            props={{
                title: t("joinTitle"),
                description: t("joinLinkText"),
                linkLabel: t("haveLink"),
                placeholder: t("linkPlaceholder"),
                failTitle: error?.title ?? t("errGeneric"),
                value,
                error: error?.body,
                preview: token === null ? undefined : previewOf(view, token, isAccepting, t),
                isReading: token !== null && "isLoading" in read.slot,
            }}
            on={{
                setValue,
                accept: () => {
                    if (token === null || view?.visitor !== "ready") return
                    void accept(token).then((id) => {
                        if (id !== undefined) router.push(workspaceHref(id, APP_ROUTES.workspaceHome))
                    })
                },
            }}
        />
    )
}
