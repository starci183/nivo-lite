"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, Button, Input, SurfaceCard, Text } from "@starci/grammar/common"
import { CopyField } from "@/features/connections/CopyField"
import { useT } from "@/i18n/client"
import { developers as dict } from "@/i18n/dict/developers"
import { createApiKey, type ApiKeyView } from "@/lib/api-keys-actions"
import { ApiKeyItem } from "./ApiKeyItem"
import { FIELD_GROW_CLASS, FORM_ROW_CLASS, KEY_BOX_CLASS, STACK_CLASS } from "./classNames"

/** "Khoá API": create a key (shown once), then the list with revoke. */
export const ApiKeysSection = ({ items, loadError }: { readonly items: ReadonlyArray<ApiKeyView>; readonly loadError: string | null }) => {
  const t = useT(dict)
  const router = useRouter()
  const [name, setName] = useState("")
  const [fresh, setFresh] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const create = () => startTransition(async () => {
    setError(null)
    const r = await createApiKey(name)
    if (!r.ok) return setError(r.error)
    setFresh(r.data.key)
    setName("")
    router.refresh()
  })

  return (
    <SurfaceCard label={t("keysTitle")} headingLevel={2}>
      <div className={STACK_CLASS}>
        <Text size="sm" tone="muted">{t("keysBody")}</Text>
        <div className={FORM_ROW_CLASS}>
          <div className={FIELD_GROW_CLASS}>
            <Input id="api-key-name" name="keyName" label={t("keyName")} variant="secondary" placeholder={t("keyNameHint")} isDisabled={isPending} value={name} onValueChange={setName} />
          </div>
          <Button variant="primary" isPending={isPending} isDisabled={name.trim().length < 2} onPress={create}>{t("create")}</Button>
        </div>
        {error ? <Alert tone="negative" title={error} /> : null}
        {fresh ? (
          <div className={KEY_BOX_CLASS}>
            <Text weight="semibold">{t("newKeyTitle")}</Text>
            <Alert tone="cautionary" title={t("newKeyWarn")} />
            <CopyField label={t("newKeyTitle")} value={fresh} />
            <div><Button variant="outline" onPress={() => setFresh(null)}>{t("newKeyDone")}</Button></div>
          </div>
        ) : null}
        {loadError ? <Alert tone="negative" title={t("keysLoadFailed")} description={loadError} /> : null}
        {items.length === 0 && !loadError ? <Text size="sm" tone="muted">{t("keysEmpty")}</Text> : null}
        <div>{items.map((k) => <ApiKeyItem key={k.id} item={k} />)}</div>
      </div>
    </SurfaceCard>
  )
}
