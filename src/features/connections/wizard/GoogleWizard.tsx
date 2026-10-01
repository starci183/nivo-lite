"use client"

import { useState, useTransition } from "react"
import { useSearchParams } from "next/navigation"
import { Alert, Button, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { googleWizard } from "@/i18n/dict/googleWizard"
import { startGoogleConnect } from "@/lib/google-actions"
import { PROVIDERS } from "@/lib/connection-providers"
import { WizardFrame } from "./WizardFrame"

const FAIL_KEY = { denied: "failDenied", unavailable: "failUnavailable", state: "failState", no_refresh: "failNoRefresh" } as const

/** Google in the shared wizard frame: what NIVO will be allowed (only files it creates), then "Kết nối Google" (OAuth), then Done. Also the landing for ?google=ok|error. */
export const GoogleWizard = ({ onClose, reconnect = false }: { readonly onClose: (changed: boolean) => void; readonly reconnect?: boolean }) => {
  const t = useT(googleWizard)
  const tw = useT(connectionWizard)
  const locale = useLocale()
  const params = useSearchParams()
  const result = params.get("google")
  const reason = params.get("reason") ?? ""
  const def = PROVIDERS.google
  const [index, setIndex] = useState(result === "ok" ? 1 : 0)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const connect = () => startTransition(async () => {
    setError(null)
    const r = await startGoogleConnect("/connections")
    if (!r.ok) return setError(r.error)
    window.location.assign(r.data.url)
  })

  const failKey = reason in FAIL_KEY ? FAIL_KEY[reason as keyof typeof FAIL_KEY] : "failGeneric"
  const footer = index === 0
    ? <><Button variant="primary" isPending={isPending} onPress={connect}>{reconnect ? t("reconnect") : t("connect")}</Button><Button variant="ghost" isDisabled={isPending} onPress={() => onClose(false)}>{tw("close")}</Button></>
    : <Button variant="primary" onPress={() => onClose(true)}>{tw("done")}</Button>

  return (
    <WizardFrame title={tw("title", { provider: def.title[locale] })} steps={[t("stepConnect"), t("stepDone")]} index={index} footer={footer}>
      {index === 0 ? (
        <div className="flex flex-col gap-2">
          <Text weight="semibold">{t("allowTitle")}</Text>
          <Text size="sm">{t("allowOnlyFiles")}</Text>
          <Text size="sm" tone="muted">{t("allowNoOthers")}</Text>
          <Text size="sm" tone="muted">{t("allowRevoke")}</Text>
          {result === "error" ? <Alert tone="negative" title={`${t("failTitle")}. ${t(failKey)}`} /> : null}
        </div>
      ) : (
        <Alert tone="affirmative" title={`${t("doneTitle")}. ${t("doneBody", { email: t("doneNoEmail") })}`} />
      )}
      {error ? <Alert tone="negative" title={error} /> : null}
    </WizardFrame>
  )
}
