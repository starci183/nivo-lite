import Link from "next/link"
import { Badge, EmptyNotice, PageContainer, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import { getT } from "@/i18n/server"
import { knowledge as dict } from "@/i18n/dict/knowledge"
import type { KnowledgeModule, NivoItem } from "@/lib/knowledge/shared"
import { PAGE_CLASS, PASSAGE_TEXT_CLASS, ROW_WRAP_CLASS, STACK_CLASS } from "./classNames"

const ORDER: ReadonlyArray<KnowledgeModule> = ["core", "chatbot", "sales", "accounting"]

/** /knowledge/nivo: NIVO base knowledge per module, read-only for every member. */
export const NivoBrowse = async ({ items }: { readonly items: ReadonlyArray<NivoItem> }) => {
  const t = await getT(dict)
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <Link href="/knowledge" className="text-sm text-muted underline-offset-2 hover:underline">{t("nivoBack")}</Link>
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("nivoTitle")} description={t("nivoDescription")} />
        {items.length === 0 ? <EmptyNotice message={t("nivoTitle")} description={t("nivoEmpty")} /> : null}
        {ORDER.map((m) => {
          const list = items.filter((i) => i.module === m)
          if (list.length === 0) return null
          return (
            <SurfaceCard key={m} label={m === "core" ? t("moduleCore") : t(`module_${m}`)} headingLevel={2}>
              <div className={STACK_CLASS}>
                {list.map((i) => (
                  <details key={i.id} className="rounded-lg border border-separator px-3 py-2">
                    <summary className="cursor-pointer">
                      <span className={ROW_WRAP_CLASS}>
                        <Text weight="semibold" size="sm">{i.title}</Text>
                        <Badge tone="accent">{t(`nivoKind_${i.kind}`)}</Badge>
                        <Text size="xs" tone="muted">{t("nivoVersion", { version: i.version })}</Text>
                      </span>
                    </summary>
                    <div className={`${PASSAGE_TEXT_CLASS} pt-3`}>{i.body}</div>
                  </details>
                ))}
              </div>
            </SurfaceCard>
          )
        })}
      </div>
    </PageContainer>
  )
}
