"use client"

import { useTranslations } from "next-intl"
import { useQueryAuthUserSwr } from "@/hooks/auth"
import { slotOfReads } from "@/hooks/slot"
import { useQueryInvitePreviewSwr } from "@/hooks/swr"
import { AUTH_ROUTES, invitePath, loginPath, signupPath } from "@/modules/routes"
import type { DataSlot } from "@/modules/types"

/** What the visitor can do with the invitation: nothing (unusable link), sign in, switch account, or accept. */
export type InviteVisitor = "unavailable" | "signedOut" | "mismatch" | "ready"

/** Everything the invitation card draws, in the visitor's words. */
export interface InviteView {
    readonly visitor: InviteVisitor
    readonly token: string
    readonly next: string
    readonly title: string
    readonly body: string
    /** The workspace the invitation is for; empty until it reads. */
    readonly workspaceName: string
    /** The e-mail the invitation is for and the staff member it attaches to, as values of the card's description list. */
    readonly forEmail: string
    readonly asStaff?: string | undefined
    readonly forTerm: string
    /** The role the invitation gives, and its term. */
    readonly roleTerm: string
    readonly roleLabel: string
    readonly staffTerm: string
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

/** The invitation read through the one status recipe: its slot, a same-shape placeholder for the skeleton, and the read again after a failure. */
export interface InviteRead {
    readonly slot: DataSlot<InviteView>
    /** What the card draws, as a skeleton, while the invitation and the session are read. */
    readonly placeholder: InviteView
    readonly retry: () => void
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
 * `enabled` false reads nothing (a join field whose text is not a link yet).
 */
export const useInviteView = (token: string, enabled = true): InviteRead => {
    const t = useTranslations("invite")
    const userRead = useQueryAuthUserSwr()
    const { data: user } = userRead
    const swrRead = useQueryInvitePreviewSwr({ token }, enabled)
    const { data: preview } = swrRead
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
        forTerm: t("forTerm"),
        roleTerm: t("roleTerm"),
        roleLabel: "",
        staffTerm: t("staffTerm"),
        signedOutHint: "",
        mismatchBody: "",
        workspaceName: "",
    }
    const placeholder: InviteView = { ...base, visitor: "ready", title: t("eyebrow"), body: "" }
    const view = (): InviteView | undefined => {
        if (preview === undefined || user === undefined) return undefined
        if (preview.state !== "pending") return { ...base, visitor: "unavailable", ...unavailableCopy(t, preview.state) }
        const role = t(preview.role === "manager" ? "roleManager" : "roleStaff")
        return {
            ...base,
            visitor: visitorOf(email, preview.email),
            title: t("title", { workspace: preview.workspaceName }),
            body: t("lead", { workspace: preview.workspaceName, role }),
            workspaceName: preview.workspaceName,
            roleLabel: role,
            forEmail: preview.email,
            asStaff: preview.staffName ?? undefined,
            signedOutHint: t("signedOutHint", { email: preview.email }),
            mismatchBody: t("mismatchBody", { current: email ?? "", email: preview.email }),
        }
    }
    return {
        slot: slotOfReads([swrRead, userRead], view),
        placeholder,
        retry: () => void swrRead.mutate(),
    }
}

