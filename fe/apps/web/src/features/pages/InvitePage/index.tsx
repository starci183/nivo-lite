import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { getPrincipal, readInvitePreview } from "@/modules/db"
import { AUTH_ROUTES, invitePath, loginPath, signupPath } from "@/modules/routes"
import { InvitePageBase } from "./component"
import type { InvitePageBaseProps } from "./component"

/** What the route passes through: the invitation token in the URL. */
interface InvitePageProps {
    readonly params: Promise<{ readonly token: string }>
}

/** The document title of the page. */
export const inviteMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("invite")
    return { title: t("eyebrow") }
}

type Translate = Awaited<ReturnType<typeof getTranslations<"invite">>>

/** The title and body of a link that cannot be used any more. */
const unavailableCopy = (t: Translate, state: string): { readonly title: string; readonly body: string } => {
    if (state === "expired") return { title: t("expiredTitle"), body: t("expiredBody") }
    if (state === "revoked") return { title: t("revokedTitle"), body: t("revokedBody") }
    if (state === "accepted") return { title: t("usedTitle"), body: t("usedBody") }
    return { title: t("invalidTitle"), body: t("invalidBody") }
}

/** What the visitor can do with a usable invitation. */
const visitorOf = (signedInEmail: string | undefined, invitedEmail: string): InvitePageBaseProps["state"] => {
    if (signedInEmail === undefined) return "signedOut"
    return signedInEmail.toLowerCase() === invitedEmail.toLowerCase() ? "ready" : "mismatch"
}

/**
 * A public invitation page: what the visitor was invited to, and the right next step for a signed-out visitor, one signed in
 * with another e-mail, and the invited person. The preview comes from the anonymous-callable `invite_preview` function.
 */
export const InvitePage = async (props: InvitePageProps) => {
    const { token } = await props.params
    const t = await getTranslations("invite")
    const next = invitePath(token)
    const [preview, principal] = await Promise.all([readInvitePreview(token), getPrincipal()])
    const email = principal.kind === "ok" ? (principal.value.email ?? "") : undefined
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
    }
    if (preview.kind !== "ok" || preview.value.state !== "pending") {
        const copy = unavailableCopy(t, preview.kind === "ok" ? preview.value.state : "invalid")
        return (
            <InvitePageBase
                state="unavailable"
                props={{ ...base, ...copy, forEmail: "", signedOutHint: "", mismatchBody: "" }}
            />
        )
    }
    const invite = preview.value
    return (
        <InvitePageBase
            state={visitorOf(email, invite.email)}
            props={{
                ...base,
                title: t("title", { workspace: invite.workspaceName }),
                body: t("lead", {
                    workspace: invite.workspaceName,
                    role: t(invite.role === "manager" ? "roleManager" : "roleStaff"),
                }),
                forEmail: t("forEmail", { email: invite.email }),
                asStaff: invite.staffName === null ? undefined : t("asStaff", { name: invite.staffName }),
                signedOutHint: t("signedOutHint", { email: invite.email }),
                mismatchBody: t("mismatchBody", { current: email ?? "", email: invite.email }),
            }}
        />
    )
}
