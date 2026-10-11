"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert, Badge, Button, Drawer, ListRow, SectionHeader, SurfaceListCard } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connections as dict } from "@/i18n/dict/connections"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import type { Connection, Provider } from "@/lib/channels"
import { PROVIDER_GROUPS, PROVIDERS, type ProviderGroup } from "@/lib/connection-providers"
import { GROUP_CLASS, PAGE_CLASS } from "./classNames"
import { ConnectionRow } from "./ConnectionRow"
import { ProviderLogo } from "./ProviderLogo"
import type { AgentOption } from "./wizard/AgentStep"
import { GoogleWizard } from "./wizard/GoogleWizard"
import { MoneyWizard } from "./wizard/MoneyWizard"
import { SmtpWizard } from "./wizard/SmtpWizard"
import { TelegramWizard } from "./wizard/TelegramWizard"
import { WebhookWizard } from "./wizard/WebhookWizard"
import { ZaloWizard } from "./wizard/ZaloWizard"

/** Props for {@link ConnectionsBoard}. */
export type ConnectionsBoardProps = {
  readonly items: ReadonlyArray<Connection>
  readonly agentNames: Readonly<Record<string, string>>
  /** The workspace agents (any module); each provider offers the ones of its own module. */
  readonly agents: ReadonlyArray<AgentOption>
  readonly localOnly: boolean
  /** Zalo OAuth just returned for this connection: open its wizard at the check step. */
  readonly zaloResumeId?: string
  readonly zaloReturned?: string
  /** The signed-in person's email: the default recipient of the SMTP test message. */
  readonly ownerEmail: string
  /** The provider groups to show (default: all). */
  readonly groups?: typeof PROVIDER_GROUPS
  /** Inside another page (Developers): no page heading, no attention banner, no group headings. */
  readonly isEmbedded?: boolean
  /** The workspace owner: adds, changes and removes connections and decides which agents use them. Others read. */
  readonly canManage?: boolean
}

type Open = { readonly provider: Provider; readonly resumeId?: string } | null

const GROUP_TITLE: Record<ProviderGroup, "groupMoney" | "groupChat" | "groupTools"> = { money: "groupMoney", chat: "groupChat", tools: "groupTools" }
const RESUMABLE: ReadonlySet<string> = new Set(["money", "zalo"])

/**
 * The Connections board. One focal point (the first connection that needs attention, with the page's only filled action), then the
 * providers grouped by what they bring in: connected providers as their own list, the rest in one compact "Not connected" list per
 * group. Every wizard opens in one Drawer, so the lists stay where they are.
 */
export const ConnectionsBoard = ({ items, agentNames, agents, localOnly, zaloResumeId, zaloReturned, ownerEmail, groups = PROVIDER_GROUPS, isEmbedded = false, canManage = false }: ConnectionsBoardProps) => {
  const t = useT(dict)
  const tw = useT(connectionWizard)
  const locale = useLocale()
  const router = useRouter()
  const params = useSearchParams()
  const connect = params.get("connect")
  const [open, setOpen] = useState<Open>(
    zaloResumeId ? { provider: "zalo_oa", resumeId: zaloResumeId }
    : params.get("google") ? { provider: "google" }
    : connect && connect in PROVIDERS ? { provider: connect as Provider }
    : null,
  )

  const close = (changed: boolean) => {
    setOpen(null)
    if (changed) router.refresh()
  }
  const canReopen = (p: Provider) => RESUMABLE.has(PROVIDERS[p].kind)
  const namesFor = (c: Connection) => c.agentIds.map((id) => agentNames[id]).filter((n): n is string => Boolean(n))

  const live = items.filter((c) => c.status !== "disconnected")
  const attention = live.filter((c) => c.status === "pending" || c.status === "error")
  const first = attention[0]

  const def = open ? PROVIDERS[open.provider] : null
  const eligible = def ? agents.filter((a) => a.module === def.module) : []
  const providerItems = open ? items.filter((c) => c.provider === open.provider) : []

  return (
    <div className={PAGE_CLASS}>
      {isEmbedded ? null : <SectionHeader
        level={1} title={t("title")} description={t("description")}
        meta={attention.length ? t("summary", { live: live.length, attention: attention.length }) : t("summaryCalm", { live: live.length })}
      />}

      {first && !isEmbedded ? (
        <Alert
          tone="cautionary"
          title={t("attentionTitle", { name: first.name, provider: PROVIDERS[first.provider].title[locale] })}
          description={[first.status === "pending" ? t("attentionPending") : t("attentionError"), attention.length > 1 ? t("attentionMore", { count: attention.length - 1 }) : ""].filter(Boolean).join(" ")}
          {...(canManage && canReopen(first.provider) ? { action: { label: t("attentionAction"), onAction: () => setOpen({ provider: first.provider, resumeId: first.id }) } } : {})}
        />
      ) : null}

      {canManage || isEmbedded ? null : <Alert tone="informative" title={t("ownerOnly")} />}

      {groups.map((group) => {
        const used = group.providers.filter((p) => items.some((c) => c.provider === p))
        const unused = group.providers.filter((p) => !used.includes(p))
        const groupCount = items.filter((c) => group.providers.includes(c.provider)).length
        return (
          <section key={group.id} className={GROUP_CLASS} {...(isEmbedded ? {} : { "aria-labelledby": `group-${group.id}` })}>
            {isEmbedded ? null : <SectionHeader id={`group-${group.id}`} level={2} title={t(GROUP_TITLE[group.id])} {...(groupCount ? { count: groupCount } : {})} />}
            {used.map((p) => {
              const rows = sortRows(items.filter((c) => c.provider === p))
              return (
                <div key={p} data-guide={`connections.${p}`}>
                  <SurfaceListCard
                    label={PROVIDERS[p].title[locale]} headingLevel={3} fact={t("connectionCount", { count: rows.length })}
                    {...(canManage ? { labelEnd: <Button variant="ghost" onPress={() => setOpen({ provider: p })}>{t("add")}</Button> } : {})}
                  >
                    {rows.map((c) => (
                      <ConnectionRow
                        key={c.id} connection={c} agentNames={namesFor(c)} localOnly={localOnly} ownerEmail={ownerEmail} agents={agents} canManage={canManage}
                        {...(canReopen(p) ? { onOpen: () => setOpen({ provider: p, resumeId: c.id }) } : {})}
                      />
                    ))}
                  </SurfaceListCard>
                </div>
              )
            })}
            {unused.length ? (
              <SurfaceListCard label={t("notConnected")} headingLevel={3}>
                {unused.map((p) => (
                  <ListRow
                    key={p}
                    leading={<ProviderLogo provider={p} />}
                    title={<span data-guide={`connections.${p}`}>{PROVIDERS[p].title[locale]}</span>}
                    {...(PROVIDERS[p].earlyAccess ? { badges: <Badge tone="neutral">{tw("earlyAccess")}</Badge> } : {})}
                    description={PROVIDERS[p].blurb[locale]}
                    {...(canManage ? { actions: <Button variant="outline" onPress={() => setOpen({ provider: p })}>{t("connect")}</Button> } : {})}
                  />
                ))}
              </SurfaceListCard>
            ) : null}
          </section>
        )
      })}

      <Drawer
        isOpen={open !== null} onOpenChange={(isOpen) => { if (!isOpen) close(true) }}
        title={def ? def.title[locale] : ""} closeLabel={tw("close")} placement="right"
      >
        {open && def?.kind === "money" ? <MoneyWizard key={open.resumeId ?? "new"} provider={open.provider as "sepay" | "payos" | "casso"} resumeId={open.resumeId} agents={eligible} onClose={close} /> : null}
        {open && def?.kind === "telegram" ? <TelegramWizard agents={eligible} onClose={close} /> : null}
        {open && def?.kind === "zalo" ? <ZaloWizard key={open.resumeId ?? "new"} resumeId={open.resumeId} returned={zaloReturned} agents={eligible} onClose={close} /> : null}
        {open && def?.kind === "webhook" ? <WebhookWizard onClose={close} /> : null}
        {open && def?.kind === "google" ? <GoogleWizard onClose={close} /> : null}
        {open && def?.kind === "email" ? <SmtpWizard ownerEmail={ownerEmail} hasDefault={providerItems.some((c) => c.status === "connected" && c.isDefault)} onClose={close} /> : null}
      </Drawer>
    </div>
  )
}

/** Rows of one provider: what needs attention first, then what runs, then what was disconnected; newest first within each. */
const STATUS_RANK: Readonly<Record<string, number>> = { error: 0, pending: 0, connected: 1, disconnected: 2 }
const sortRows = (rows: ReadonlyArray<Connection>): ReadonlyArray<Connection> =>
  [...rows].sort((a, b) => (STATUS_RANK[a.status] ?? 1) - (STATUS_RANK[b.status] ?? 1))
