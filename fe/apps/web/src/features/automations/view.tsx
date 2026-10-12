"use client"

import { Breadcrumbs, Link, PageContainer, SectionHeader, TextAction } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { automations as dict } from "@/i18n/dict/automations"
import { AutomationsBoard } from "./AutomationsBoard"
import { HEAD_CLASS, LINK_ROW_CLASS, PAGE_CLASS } from "./classNames"
import type { AutomationsData } from "./useAutomations"

/** Props for {@link AutomationsView}. */
export type AutomationsViewProps = {
  /** The workspace's name (the page eyebrow); unknown while the page loads. */
  readonly workspaceName?: string
  readonly data: AutomationsData
  readonly focus?: string
  /** STATE-8: the same page while its data loads - heading, filters and links stay, the cards are skeletons. */
  readonly isLoading?: boolean
}

/** The Automations page body: header with its trail, the board of cards and the link to Advanced. */
export const AutomationsView = ({ workspaceName, data, focus, isLoading = false }: AutomationsViewProps) => {
  const t = useT(dict)
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <div className={HEAD_CLASS}>
          <Breadcrumbs label={t("crumbLabel")} items={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "automations", label: t("title") }]} />
          <SectionHeader
            level={1}
            eyebrow={workspaceName}
            title={t("title")}
            description={<>{t("leadBefore")}<Link href="/authority">{t("leadLink")}</Link>{t("leadAfter")}</>}
          />
        </div>
        <AutomationsBoard initial={data} layout="page" focus={focus} isLoading={isLoading} />
        <div className={LINK_ROW_CLASS}><TextAction href="/developers" size="sm" appearance="muted">{t("advanced")}</TextAction></div>
      </div>
    </PageContainer>
  )
}
