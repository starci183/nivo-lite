"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, Button } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { invite } from "@/i18n/dict/invite"
import { acceptInvite } from "@/lib/invites"
import { INVITE_ACTIONS_CLASS } from "./classNames"

/** The "Tham gia" button: accepts the invitation for the signed-in person, then opens the console. */
export const AcceptInvite = ({ token }: { readonly token: string }) => {
  const t = useT(invite)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const accept = () => {
    setError(null)
    startTransition(async () => {
      const result = await acceptInvite(token)
      if (result.ok) router.push("/chat")
      else setError(result.error)
    })
  }

  return (
    <div className={INVITE_ACTIONS_CLASS}>
      {error ? <Alert title={t("failed")} description={error} tone="negative" /> : null}
      <Button variant="primary" isPending={isPending} onPress={accept}>{t("accept")}</Button>
    </div>
  )
}
