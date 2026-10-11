"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDialog, Badge, Button, ListItem, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { developers as dict } from "@/i18n/dict/developers"
import { intlLocale, TIME_ZONE } from "@/i18n/core"
import { revokeApiKey, type ApiKeyView } from "@/lib/api-keys-actions"
import { ACTIONS_CLASS, KEY_MAIN_CLASS, KEY_ROW_CLASS, ROW_NOTE_CLASS } from "./classNames"

/** One API key row: name, prefix, dates, status and "Thu hồi" confirmed through an AlertDialog. */
export const ApiKeyItem = ({ item }: { readonly item: ApiKeyView }) => {
  const t = useT(dict)
  const locale = useLocale()
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const date = (iso: string) => new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(iso))

  const revoke = () => startTransition(async () => {
    setError(null)
    const r = await revokeApiKey(item.id)
    setConfirm(false)
    if (!r.ok) return setError(r.error)
    router.refresh()
  })

  return (
    <ListItem className={KEY_ROW_CLASS}>
      <div className={KEY_MAIN_CLASS}>
        <Text weight="semibold">{item.name}</Text>
        <Text size="sm" tone="muted">{t("prefix", { prefix: `${item.prefix}…` })}</Text>
        <Text size="xs" tone="muted">{`${t("created", { date: date(item.createdAt) })} · ${item.lastUsedAt ? t("lastUsed", { date: date(item.lastUsedAt) }) : t("neverUsed")}`}</Text>
      </div>
      <div className={ACTIONS_CLASS}>
        <Badge isDot tone={item.revokedAt ? "neutral" : "success"}>{item.revokedAt ? t("revoked") : t("active")}</Badge>
        {item.revokedAt ? null : <Button variant="danger-soft" isDisabled={isPending} onPress={() => setConfirm(true)}>{t("revoke")}</Button>}
      </div>
      <AlertDialog
        isOpen={confirm}
        onOpenChange={setConfirm}
        title={t("revokeAsk", { name: item.name })}
        tone="negative"
        confirmLabel={t("revokeConfirm")}
        cancelLabel={t("cancel")}
        isConfirmPending={isPending}
        onConfirm={revoke}
        onCancel={() => setConfirm(false)}
      />
      {error ? <div className={ROW_NOTE_CLASS}><Alert tone="negative" title={error} /></div> : null}
    </ListItem>
  )
}
