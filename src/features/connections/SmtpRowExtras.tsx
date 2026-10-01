"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, Badge, Button, Input, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { email } from "@/i18n/dict/email"
import type { Connection } from "@/lib/channels"
import { changeSmtpPassword, sendSmtpTest, setDefaultSmtp } from "@/lib/email-actions"
import { ACTIONS_CLASS, FULL_BOX_CLASS } from "./classNames"

/** Props for {@link SmtpRowExtras}. */
export type SmtpRowExtrasProps = { readonly connection: Connection; readonly ownerEmail: string }

type Panel = "test" | "password" | null
type Note = { tone: "affirmative" | "negative"; text: string }

/** The SMTP-only part of a connection row: the default badge, "Gửi email thử", "Đổi mật khẩu" and "Đặt làm mặc định". */
export const SmtpRowExtras = ({ connection: c, ownerEmail }: SmtpRowExtrasProps) => {
  const t = useT(email)
  const router = useRouter()
  const [panel, setPanel] = useState<Panel>(null)
  const [to, setTo] = useState(ownerEmail)
  const [password, setPassword] = useState("")
  const [note, setNote] = useState<Note | null>(null)
  const [isPending, startTransition] = useTransition()

  const close = () => { setPanel(null); setPassword("") }
  const test = () => startTransition(async () => {
    setNote(null)
    const r = await sendSmtpTest(c.id, to, false)
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    setNote({ tone: "affirmative", text: t("testOk", { to: r.data.to }) })
    router.refresh()
  })
  const savePassword = () => startTransition(async () => {
    setNote(null)
    const r = await changeSmtpPassword(c.id, password)
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    close()
    setNote({ tone: "affirmative", text: t("rowPasswordChanged") })
    router.refresh()
  })
  const makeDefault = () => startTransition(async () => {
    setNote(null)
    const r = await setDefaultSmtp(c.id)
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    router.refresh()
  })

  return (
    <>
      <div className={ACTIONS_CLASS}>
        {c.isDefault && c.status === "connected" ? <Badge tone="success">{t("rowDefault")}</Badge> : null}
        <Button variant="secondary" isDisabled={isPending} onPress={() => { setNote(null); setPanel(panel === "test" ? null : "test") }}>{t("rowTest")}</Button>
        <Button variant="outline" isDisabled={isPending} onPress={() => { setNote(null); setPanel(panel === "password" ? null : "password") }}>{t("rowChangePassword")}</Button>
        {c.status === "connected" && !c.isDefault ? <Button variant="outline" isDisabled={isPending} onPress={makeDefault}>{t("rowSetDefault")}</Button> : null}
      </div>
      {panel === "test" ? (
        <div className={FULL_BOX_CLASS}>
          <Input id={`smtp-row-to-${c.id}`} name="testTo" label={t("testTo")} variant="secondary" isDisabled={isPending} value={to} onValueChange={setTo} />
          <div className={ACTIONS_CLASS}>
            <Button variant="primary" isPending={isPending} isDisabled={!to.trim()} onPress={test}>{t("testSend")}</Button>
            <Button variant="ghost" onPress={close}>{t("rowCancel")}</Button>
          </div>
        </div>
      ) : null}
      {panel === "password" ? (
        <div className={FULL_BOX_CLASS}>
          <Input id={`smtp-row-pw-${c.id}`} name="password" label={t("rowNewPassword")} variant="secondary" kind="password" isDisabled={isPending} value={password} onValueChange={setPassword} />
          <Text size="xs" tone="muted">{t("passwordStored")}</Text>
          <div className={ACTIONS_CLASS}>
            <Button variant="primary" isPending={isPending} isDisabled={!password.trim()} onPress={savePassword}>{t("rowSavePassword")}</Button>
            <Button variant="ghost" onPress={close}>{t("rowCancel")}</Button>
          </div>
        </div>
      ) : null}
      {note ? <div className="w-full"><Alert title={note.text} tone={note.tone} /></div> : null}
    </>
  )
}
