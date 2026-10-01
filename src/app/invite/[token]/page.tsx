import Link from "next/link"
import { redirect } from "next/navigation"
import { Heading, Text } from "@starci/grammar/common"
import { NivoLogo } from "@/components/brand/NivoLogo"
import { AcceptInvite } from "@/features/team/AcceptInvite"
import { CARD_CLASS, INVITE_ACTIONS_CLASS, INVITE_CANVAS_CLASS, INVITE_CARD_CLASS } from "@/features/team/classNames"
import { getInvitePreview } from "@/features/team/invite-preview"
import { invite as dict } from "@/i18n/dict/invite"
import { getT } from "@/i18n/server"
import { supabaseServer } from "@/lib/supabase/server"

type InvitePageProps = { readonly params: Promise<{ token: string }> }

const linkButton = "inline-flex min-h-10 items-center justify-center rounded-full px-5 py-2 text-sm font-medium"

/** A public invitation page: who invited you, to what, and the right next step for signed-out and signed-in visitors. */
const InvitePage = async ({ params }: InvitePageProps) => {
  const { token } = await params
  const t = await getT(dict)
  const preview = await getInvitePreview(token).catch(() => null)
  const next = `/invite/${token}`

  const signOutAndBack = async () => {
    "use server"
    await (await supabaseServer()).auth.signOut()
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  const frame = (title: string, body: string, extra?: React.ReactNode) => (
    <main className={INVITE_CANVAS_CLASS}>
      <div className={INVITE_CARD_CLASS}>
        <NivoLogo variant="full" height={40} />
        <section className={CARD_CLASS}><Heading level={1} scale="standard">{title}</Heading>
          <div className={INVITE_ACTIONS_CLASS}>
            <Text tone="muted">{body}</Text>
            {extra}
          </div>
        </section>
      </div>
    </main>
  )

  const toSignIn = (
    <Link href="/login" className={`${linkButton} border border-separator`}>{t("goSignIn")}</Link>
  )

  if (!preview) return frame(t("invalidTitle"), t("invalidBody"), toSignIn)
  if (preview.state === "expired") return frame(t("expiredTitle"), t("expiredBody"), toSignIn)
  if (preview.state === "revoked") return frame(t("revokedTitle"), t("revokedBody"), toSignIn)
  if (preview.state === "accepted") return frame(t("usedTitle"), t("usedBody"), toSignIn)

  const { data } = await (await supabaseServer()).auth.getUser()
  const user = data.user
  const role = t(preview.role === "manager" ? "roleManager" : "roleStaff")
  const lead = preview.inviterName
    ? t("lead", { inviter: preview.inviterName, workspace: preview.workspaceName, role })
    : t("leadNoInviter", { workspace: preview.workspaceName, role })

  const mismatch = user && (user.email ?? "").toLowerCase() !== preview.email.toLowerCase()

  return (
    <main className={INVITE_CANVAS_CLASS}>
      <div className={INVITE_CARD_CLASS}>
        <NivoLogo variant="full" height={40} />
        <section className={CARD_CLASS}><Heading level={1} scale="standard">{t("title", { workspace: preview.workspaceName })}</Heading>
          <div className={INVITE_ACTIONS_CLASS}>
            <Text>{lead}</Text>
            <Text size="sm" tone="muted">{t("forEmail", { email: preview.email })}</Text>
            {preview.staffName ? <Text size="sm" tone="muted">{t("asStaff", { name: preview.staffName })}</Text> : null}
            {!user ? (
              <>
                <Text size="sm" tone="muted">{t("signedOutHint", { email: preview.email })}</Text>
                <Link href={`/login?next=${encodeURIComponent(next)}`} className={`${linkButton} bg-accent text-accent-foreground`}>{t("signIn")}</Link>
                <Link href={`/signup?invite=${encodeURIComponent(token)}`} className={`${linkButton} border border-separator`}>{t("signUp")}</Link>
              </>
            ) : mismatch ? (
              <>
                <Text weight="semibold">{t("mismatchTitle")}</Text>
                <Text size="sm" tone="muted">{t("mismatchBody", { current: user.email ?? "", email: preview.email })}</Text>
                <form action={signOutAndBack}>
                  <button type="submit" className={`${linkButton} w-full border border-separator`}>{t("switchAccount")}</button>
                </form>
              </>
            ) : (
              <>
                <Text size="sm" tone="muted">{t("signedInAs", { email: user.email ?? "" })}</Text>
                <AcceptInvite token={token} />
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

export default InvitePage
