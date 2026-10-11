"use client"

import { Breadcrumbs, PageContainer, SectionHeader, SurfaceListCard, TextAction } from "@starci/grammar/common"
import { ConnectionsBoard } from "@/features/connections/ConnectionsBoard"
import { useT } from "@/i18n/client"
import { developers as dict } from "@/i18n/dict/developers"
import type { ApiKeyView } from "@/lib/api-keys-actions"
import type { Connection } from "@/lib/channels"
import { ApiKeysSection } from "./ApiKeysSection"
import { HEAD_CLASS, PAGE_CLASS, STACK_CLASS } from "./classNames"
import { QuickStart } from "./QuickStart"

/** Props for {@link DevelopersView}. */
export type DevelopersViewProps = {
  /** The outgoing webhooks. */
  readonly hooks: ReadonlyArray<Connection>
  readonly keys: ReadonlyArray<ApiKeyView>
  /** Why the keys could not be read (that region fails in place), or null. */
  readonly keysError: string | null
  readonly canManage: boolean
  readonly base: string
  /** STATE-8: the same page while its data loads - headings, labels and the guide's titles stay, the data is skeletons. */
  readonly isLoading?: boolean
}

/** The "Nâng cao" page body (owner | manager): outgoing webhooks, API keys, the quick guide. */
export const DevelopersView = ({ hooks, keys, keysError, canManage, base, isLoading = false }: DevelopersViewProps) => {
  const t = useT(dict)
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <div className={HEAD_CLASS}>
          <Breadcrumbs label={t("crumbLabel")} items={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "developers", label: t("title") }]} />
          <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        </div>
        <div><TextAction href="/automations" size="sm">{t("backToAutomations")}</TextAction></div>

        <div className={STACK_CLASS}>
          <SectionHeader level={2} title={t("eventsTitle")} description={t("eventsBody")} />
          {isLoading ? (
            <SurfaceListCard ariaLabel={t("eventsTitle")} isLoading />
          ) : (
            <ConnectionsBoard items={hooks} agentNames={{}} agents={[]} localOnly={false} ownerEmail="" groups={[{ id: "tools", providers: ["webhook"] }]} isEmbedded canManage={canManage} />
          )}
        </div>

        <ApiKeysSection items={keys} loadError={keysError} isLoading={isLoading} />
        <QuickStart base={base} isLoading={isLoading} />
      </div>
    </PageContainer>
  )
}
