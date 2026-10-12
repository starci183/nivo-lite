import { redirect } from "next/navigation"
import { Button, Heading, PageContainer, SurfaceCard, Text } from "@starci/grammar/common"
import { ACTION_STACK, INVITE_COLUMN, INVITE_MAIN } from "@/app/classNames"
import { BrandLogo } from "@/components/blocks/BrandLogo"
import { AcceptInvite } from "@/features/team/AcceptInvite"
import { getInvitePreview } from "@/features/team/invite-preview"
import { invite as dict } from "@/i18n/dict/invite"
import { getT } from "@/i18n/server"
import { supabaseServer } from "@/lib/supabase/server"

type InvitePageProps = { readonly params: Promise<{ token: string }> }

/**
 * A public invitation page: who invited you, to what, and the right next step for signed-out and signed-in visitors.
 * The card is Grammar's `SurfaceCard`, the hand-drawn pill links are `Button href` (CTA-2) and the sign-out submit is
 * a `Button type="submit"`; one primary per state (CTA-1).
 */
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

  const shell = (title: string, content: React.ReactNode) => (
    <main className={INVITE_MAIN}>
      <PageContainer measure="reading">
        <div className={INVITE_COLUMN}>
          <BrandLogo variant="full" height={40} />
          <SurfaceCard ariaLabel={title}>
            <div className={ACTION_STACK}>
              <Heading level={1}>{title}</Heading>
              {content}
            </div>
          </SurfaceCard>
        </div>
      </PageContainer>
    </main>
  )
  const frame = (title: string, body: string, extra?: React.ReactNode) =>
    shell(title, (
      <>
        <Text tone="muted">{body}</Text>
        {extra}
      </>
    ))

  const toSignIn = (
    <Button variant="secondary" width="fill" href="/login">{t("goSignIn")}</Button>
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

  return shell(t("title", { workspace: preview.workspaceName }), (
    <>
      <Text>{lead}</Text>
      <Text size="sm" tone="muted">{t("forEmail", { email: preview.email })}</Text>
      {preview.staffName ? <Text size="sm" tone="muted">{t("asStaff", { name: preview.staffName })}</Text> : null}
      {!user ? (
        <>
          <Text size="sm" tone="muted">{t("signedOutHint", { email: preview.email })}</Text>
          <Button variant="primary" width="fill" href={`/login?next=${encodeURIComponent(next)}`}>{t("signIn")}</Button>
          <Button variant="secondary" width="fill" href={`/signup?invite=${encodeURIComponent(token)}`}>{t("signUp")}</Button>
        </>
      ) : mismatch ? (
        <>
          <Text weight="semibold">{t("mismatchTitle")}</Text>
          <Text size="sm" tone="muted">{t("mismatchBody", { current: user.email ?? "", email: preview.email })}</Text>
          <form action={signOutAndBack}>
            <Button variant="secondary" width="fill" type="submit">{t("switchAccount")}</Button>
          </form>
        </>
      ) : (
        <>
          <Text size="sm" tone="muted">{t("signedInAs", { email: user.email ?? "" })}</Text>
          <AcceptInvite token={token} />
        </>
      )}
    </>
  ))
}

export default InvitePage
