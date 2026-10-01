"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Badge, Button, SurfaceCard, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connections as dict } from "@/i18n/dict/connections"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import type { Connection, Provider } from "@/lib/channels"
import { PROVIDERS } from "@/lib/connection-providers"
import { HEAD_CLASS, STACK_CLASS } from "./classNames"
import { ConnectionRow } from "./ConnectionRow"
import type { AgentOption } from "./wizard/AgentStep"
import { GoogleWizard } from "./wizard/GoogleWizard"
import { MoneyWizard } from "./wizard/MoneyWizard"
import { SmtpWizard } from "./wizard/SmtpWizard"
import { TelegramWizard } from "./wizard/TelegramWizard"
import { WebhookWizard } from "./wizard/WebhookWizard"
import { ZaloWizard } from "./wizard/ZaloWizard"

/** Props for {@link ProviderSection}. */
export type ProviderSectionProps = {
  readonly provider: Provider
  readonly items: ReadonlyArray<Connection>
  readonly agentNames: Readonly<Record<string, string>>
  /** The workspace agents (any module); each provider offers the ones of its own module. */
  readonly agents: ReadonlyArray<AgentOption>
  readonly localOnly: boolean
  /** Zalo OAuth just returned for this connection: open its wizard at the check step. */
  readonly resumeId?: string
  readonly returned?: string
  /** The signed-in person's email: the default recipient of the SMTP test message. */
  readonly ownerEmail?: string
}

type Open = { readonly resumeId?: string } | null

/** One provider card: its connections and the guided "Thêm kết nối" wizard (a new one, or the unfinished one being continued). */
export const ProviderSection = ({ provider, items, agentNames, agents, localOnly, resumeId, returned, ownerEmail = "" }: ProviderSectionProps) => {
  const t = useT(dict)
  const tw = useT(connectionWizard)
  const locale = useLocale()
  const router = useRouter()
  const def = PROVIDERS[provider]
  const googleBack = useSearchParams().get("google")
  const [open, setOpen] = useState<Open>(resumeId ? { resumeId } : provider === "google" && googleBack ? {} : null)
  const eligible = agents.filter((a) => a.module === def.module)

  const close = (changed: boolean) => {
    setOpen(null)
    if (changed) router.refresh()
  }

  return (
    <SurfaceCard label={def.title[locale]} headingLevel={2}>
      <div className={STACK_CLASS}>
        <div className={HEAD_CLASS}>
          <Text size="sm" tone="muted">{def.blurb[locale]}</Text>
          {def.earlyAccess ? <Badge tone="warning">{tw("earlyAccess")}</Badge> : null}
          {open ? null : <Button variant="secondary" onPress={() => setOpen({})}>{t("add")}</Button>}
        </div>

        {items.length === 0 && !open ? <Text size="sm" tone="muted">{t("emptyList")}</Text> : null}
        <div>
          {items.map((c) => (
            <ConnectionRow
              key={c.id} connection={c} localOnly={localOnly} ownerEmail={ownerEmail} onContinue={def.kind === "money" || def.kind === "zalo" ? () => setOpen({ resumeId: c.id }) : undefined}
              agentNames={c.agentIds.map((id) => agentNames[id]).filter((n): n is string => Boolean(n))}
            />
          ))}
        </div>

        {open && def.kind === "money" ? <MoneyWizard key={open.resumeId ?? "new"} provider={provider as "sepay" | "payos" | "casso"} resumeId={open.resumeId} agents={eligible} onClose={close} /> : null}
        {open && def.kind === "telegram" ? <TelegramWizard agents={eligible} onClose={close} /> : null}
        {open && def.kind === "zalo" ? <ZaloWizard key={open.resumeId ?? "new"} resumeId={open.resumeId} returned={returned} agents={eligible} onClose={close} /> : null}
        {open && def.kind === "webhook" ? <WebhookWizard onClose={close} /> : null}
        {open && def.kind === "google" ? <GoogleWizard onClose={close} /> : null}
        {open && def.kind === "email" ? <SmtpWizard ownerEmail={ownerEmail} hasDefault={items.some((c) => c.status === "connected" && c.isDefault)} onClose={close} /> : null}
      </div>
    </SurfaceCard>
  )
}
