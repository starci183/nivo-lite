import { PageContainer, SectionHeader } from "@starci/grammar/common"
import { getT } from "@/i18n/server"
import { inbox as dict } from "@/i18n/dict/inbox"
import type { InboundEvent } from "@/lib/flow-types"
import { PAGE_CLASS } from "./classNames"
import { Banner } from "./Banner"
import { Feed } from "./Feed"
import { Simulator } from "./Simulator"
import { BankConnection } from "./BankConnection"
import { newEventId } from "./model"

/** Props for {@link InboxPage}. */
export type InboxPageProps = { readonly events: ReadonlyArray<InboundEvent>; readonly nowIso: string }

/** The "Đầu vào" page: a permanent simulated-channels notice, the inbound simulator and the feed of received inputs. */
export const InboxPage = async ({ events, nowIso }: InboxPageProps) => {
  const t = await getT(dict)
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        <Banner title={t("simAlertTitle")} description={t("simAlertBody")} tone="cautionary" />
        <BankConnection />
        <Simulator initialEventId={newEventId()} />
        <Feed events={events} nowIso={nowIso} />
      </div>
    </PageContainer>
  )
}
