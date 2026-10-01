"use client"

import { PageContainer, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { authority } from "@/i18n/dict/authority"

/** Authority skeleton: same header, one card in loading state. */
const AuthorityLoading = () => {
  const t = useT(authority)
  return (
    <PageContainer measure="product">
      <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <SurfaceCard ariaLabel={t("loading")}>
        <Text isSkeleton>{t("loading")}</Text>
      </SurfaceCard>
    </PageContainer>
  )
}

export default AuthorityLoading
