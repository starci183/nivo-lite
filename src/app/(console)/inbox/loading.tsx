"use client"

import { PageContainer, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { inbox } from "@/i18n/dict/inbox"

/** Inbox skeleton: same header, one card in loading state. */
const InboxLoading = () => {
  const t = useT(inbox)
  return (
    <PageContainer measure="product">
      <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <SurfaceCard ariaLabel={t("loading")}>
        <Text isSkeleton>{t("loading")}</Text>
      </SurfaceCard>
    </PageContainer>
  )
}

export default InboxLoading
