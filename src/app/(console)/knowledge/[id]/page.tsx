import { PageContainer, SectionHeader } from "@starci/grammar/common"
import { SourceDetail } from "@/features/knowledge/SourceDetail"
import { getT } from "@/i18n/server"
import { knowledge as dict } from "@/i18n/dict/knowledge"
import { getSource } from "@/lib/knowledge/index"
import { isManagerRole } from "@/lib/members-shared"
import { getSession } from "@/lib/session"

const UUID = /^[0-9a-f-]{36}$/i

const Page = async ({ params }: { readonly params: Promise<{ id: string }> }) => {
  const { id } = await params
  const [session, t] = await Promise.all([getSession(), getT(dict)])
  const found = UUID.test(id) ? await getSource(id) : null
  if (!found) {
    return (
      <PageContainer measure="product">
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("notFoundTitle")} description={t("back")} />
      </PageContainer>
    )
  }
  return <SourceDetail source={found.source} chunks={found.chunks} canWrite={isManagerRole(session.member.role)} />
}

export default Page
