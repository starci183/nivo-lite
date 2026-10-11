"use client"

import { Breadcrumbs, PageContainer, SectionHeader } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { inbox as dict } from "@/i18n/dict/inbox"
import type { InboundEvent } from "@/lib/flow-types"
import { BankConnection } from "./BankConnection"
import { Banner } from "./Banner"
import { HEAD_CLASS, PAGE_CLASS } from "./classNames"
import { Feed } from "./Feed"
import { Simulator } from "./Simulator"

/** Props for {@link InboxView}. */
export type InboxViewProps = {
  readonly events: ReadonlyArray<InboundEvent>
  readonly nowIso: string
  /** The first channel event id of the simulator (generated on the server so it agrees with hydration). */
  readonly initialEventId: string
  /** STATE-8: the same page while its data loads - labels, the notice and the simulator stay, the feed is skeleton rows. */
  readonly isLoading?: boolean
}

/** The "Đầu vào" page body: a permanent simulated-channels notice, the inbound simulator and the feed of received inputs. */
export const InboxView = ({ events, nowIso, initialEventId, isLoading = false }: InboxViewProps) => {
  const t = useT(dict)
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <div className={HEAD_CLASS}>
          <Breadcrumbs label={t("crumbLabel")} items={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "inbox", label: t("title") }]} />
          <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        </div>
        <Banner title={t("simAlertTitle")} description={t("simAlertBody")} tone="cautionary" />
        <BankConnection />
        <div inert={isLoading}>
          <Simulator initialEventId={initialEventId} />
        </div>
        <Feed events={events} nowIso={nowIso} isLoading={isLoading} />
      </div>
    </PageContainer>
  )
}
