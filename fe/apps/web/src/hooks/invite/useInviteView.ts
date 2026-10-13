"use client"

import { useTranslations } from "next-intl"
import { useAuthUser } from "@/hooks/auth"
import { useQueryInvitePreviewSwr } from "@/hooks/swr"
import { AUTH_ROUTES, invitePath, loginPath, signupPath } from "@/modules/routes"

/** What the visitor can do with the invitation: wait, nothing (unusable link), sign in, switch account, or accept. */
export type InviteVisitor = "loading" | "unavailable" | "signedOut" | "mismatch" | "ready"

/** Everything the invitation card draws, in the visitor's words. */
export interface InviteView {
    readonly state: InviteVisitor
    readonly token: string
    readonly next: string
    readonly title: string
    readonly body: string
    readonly forEmail: string
    readonly asStaff?: string
    readonly signedOutHint: string
    readonly signInLabel: string
    readonly signUpLabel: string
    readonly goSignInLabel: string
    readonly loginHref: string
    readonly signInHref: string
    readonly signUpHref: string
    readonly mismatchTitle: string
    readonly mismatchBody: string
    readonly signedInAs: string
}

type Translate = ReturnType<typeof useTranslations<"invite">>

/** The title and body of a link that cannot be used any more. */
const unavailableCopy = (t: Translate, state: string): { readonly title: string; readonly body: string } => {
    if (state === "expired") return { title: t("expiredTitle"), body: t("expiredBody") }
    if (state === "revoked") return { title: t("revokedTitle"), body: t("revokedBody") }
    if (state === "accepted") return { title: t("usedTitle"), body: t("usedBody") }
    return { title: t("invalidTitle"), body: t("invalidBody") }
}

/** What the visitor can do with a usable invitation. */
const visitorOf = (signedInEmail: string | undefined, invitedEmail: string): InviteVisitor => {
    if (signedInEmail === undefined) return "signedOut"
    return signedInEmail.toLowerCase() === invitedEmail.toLowerCase() ? "ready" : "mismatch"
}

/**
 * Reads what an invitation link is for (the public `invitePreview` query) and who is looking at it (the browser session), and
 * words the right next step: sign in or up when signed out, switch account when signed in with another e-mail, accept when it matches.
 */
export const useInviteView = (token: string): InviteView => {
    const t = useTranslations("invite")
    const { data: user } = useAuthUser()
    const { data: preview, error } = useQueryInvitePreviewSwr({ token })
    const next = invitePath(token)
    const email = user === undefined || user === null ? undefined : user.email
    const base = {
        token,
        next,
        goSignInLabel: t("goSignIn"),
        signInLabel: t("signIn"),
        signUpLabel: t("signUp"),
        loginHref: AUTH_ROUTES.login,
        signInHref: loginPath(next),
        signUpHref: signupPath(token),
        signedInAs: t("signedInAs", { email: email ?? "" }),
        mismatchTitle: t("mismatchTitle"),
        forEmail: "",
        signedOutHint: "",
        mismatchBody: "",
    }
    const isLoading = (preview === undefined && error === undefined) || user === undefined
    if (isLoading) return { ...base, state: "loading", title: t("eyebrow"), body: "" }
    if (preview === undefined || preview.state !== "pending") {
        return { ...base, state: "unavailable", ...unavailableCopy(t, preview?.state ?? "invalid") }
    }
    return {
        ...base,
        state: visitorOf(email, preview.email),
        title: t("title", { workspace: preview.workspaceName }),
        body: t("lead", {
            workspace: preview.workspaceName,
            role: t(preview.role === "manager" ? "roleManager" : "roleStaff"),
        }),
        forEmail: t("forEmail", { email: preview.email }),
        asStaff:
            preview.staffName === null || preview.staffName === undefined
                ? undefined
                : t("asStaff", { name: preview.staffName }),
        signedOutHint: t("signedOutHint", { email: preview.email }),
        mismatchBody: t("mismatchBody", { current: email ?? "", email: preview.email }),
    }
}
