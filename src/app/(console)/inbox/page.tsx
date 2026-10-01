import { PageContainer, SectionHeader } from "@starci/grammar/common"
import { InboxPage } from "@/features/inbox"
import { Banner } from "@/features/inbox/Banner"
import { inbox as dict } from "@/i18n/dict/inbox"
import { getT } from "@/i18n/server"
import { listInbound } from "@/lib/flow-queries"

/** Inbox ("Đầu vào"): inbound simulator and the feed of everything NIVO received. */
const Page = async () => {
  try {
    const events = await listInbound(40)
    return <InboxPage events={events} nowIso={new Date().toISOString()} />
  } catch {
    const t = await getT(dict)
    return (
      <PageContainer measure="product">
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        <Banner title={t("loadFailTitle")} description={t("loadFailBody")} tone="negative" />
      </PageContainer>
    )
  }
}

export default Page
