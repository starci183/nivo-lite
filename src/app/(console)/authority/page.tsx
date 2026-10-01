import { PageContainer, SectionHeader } from "@starci/grammar/common"
import { AuthorityPage } from "@/features/authority"
import { Banner } from "@/features/authority/Banner"
import { authority as dict } from "@/i18n/dict/authority"
import { getT } from "@/i18n/server"
import { getAuthority, listRules, listStaff } from "@/lib/flow-queries"

/** Authority ("Giao quyền"): goals, policies, automation scope, limits and optional staff. */
const Page = async () => {
  try {
    const [authority, rules, staff] = await Promise.all([getAuthority(), listRules(), listStaff()])
    return <AuthorityPage authority={authority} rules={rules} staff={staff} />
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
