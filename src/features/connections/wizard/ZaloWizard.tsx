"use client"

import { useState, useTransition } from "react"
import { Alert, Button, Input } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connections } from "@/i18n/dict/connections"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { connectZalo } from "@/lib/connection-actions"
import { PROVIDERS } from "@/lib/connection-providers"
import { BUTTONS_CLASS, FIELDS_CLASS } from "./classNames"
import { GuideView } from "./GuideView"
import { WizardFrame } from "./WizardFrame"

const EMPTY_GUIDE = { name: "", webhookUrl: "", apiKey: "", bank: "", account: "" }
const KEYS = ["name", "oaId", "appId", "appSecret", "accessToken", "refreshToken"] as const

/** Zalo OA in the shared wizard frame: where to find the settings, then enter them (stored encrypted; sending and receiving is not live yet). */
export const ZaloWizard = ({ onClose }: { readonly onClose: (changed: boolean) => void }) => {
  const t = useT(connectionWizard)
  const c = useT(connections)
  const locale = useLocale()
  const def = PROVIDERS.zalo_oa
  const [index, setIndex] = useState(0)
  const [f, setF] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const v = (k: string) => f[k] ?? ""

  const save = () => startTransition(async () => {
    const r = await connectZalo({ name: v("name"), oaId: v("oaId"), appId: v("appId"), appSecret: v("appSecret"), accessToken: v("accessToken"), refreshToken: v("refreshToken") })
    if (!r.ok) return setError(r.error)
    onClose(true)
  })

  const label: Record<(typeof KEYS)[number], string> = {
    name: c("fieldName"), oaId: c("fieldOaId"), appId: c("fieldAppId"), appSecret: c("fieldAppSecret"), accessToken: c("fieldAccessToken"), refreshToken: c("fieldRefreshToken"),
  }
  const footer = index === 0
    ? <><Button variant="primary" onPress={() => setIndex(1)}>{t("next")}</Button><Button variant="ghost" onPress={() => onClose(false)}>{t("close")}</Button></>
    : <><Button variant="primary" isPending={isPending} isDisabled={!v("name").trim()} onPress={save}>{t("done")}</Button><Button variant="outline" isDisabled={isPending} onPress={() => setIndex(0)}>{t("back")}</Button></>

  return (
    <WizardFrame title={t("title", { provider: def.title[locale] })} steps={[t("stepFollow", { brand: def.brand }), t("stepSettings")]} index={index} footer={footer}>
      {index === 0 ? (
        <>
          <div className={BUTTONS_CLASS}><Button variant="outline" href={def.dashboard.live ?? "https://oa.zalo.me"} target="_blank" rel="noreferrer">{t("openProvider", { brand: def.brand })}</Button></div>
          <GuideView brand={def.brand} steps={def.guide} ctx={EMPTY_GUIDE} values={{}} onValue={() => undefined} />
        </>
      ) : (
        <>
          <Alert tone="informative" title={c("zaloSoon")} />
          <div className={FIELDS_CLASS}>
            {KEYS.map((k) => (
              <Input key={k} id={`zalo-${k}`} name={k} label={label[k]} variant="secondary" kind={k === "appSecret" || k.endsWith("Token") ? "password" : "text"} isDisabled={isPending} value={v(k)} onValueChange={(x) => setF((p) => ({ ...p, [k]: x }))} />
            ))}
          </div>
        </>
      )}
      {error ? <Alert tone="negative" title={error} /> : null}
    </WizardFrame>
  )
}
