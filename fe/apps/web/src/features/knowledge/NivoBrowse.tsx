import { Badge, Breadcrumbs, Button, Disclosure, EmptyNotice, List, ListItem, PageContainer, SectionHeader, SurfaceCard, SurfaceListCard, Text } from "@starci/grammar/common"
import { getT } from "@/i18n/server"
import { knowledge as dict } from "@/i18n/dict/knowledge"
import type { KnowledgeModule, NivoItem } from "@/lib/knowledge/shared"
import { MODULE_KEYS } from "@/lib/module-registry"
import { HEAD_CLASS, ITEM_CLASS, LIST_CLASS, PAGE_CLASS, PASSAGE_TEXT_CLASS, ROW_WRAP_CLASS } from "./classNames"
import { knowledgeTrail } from "./trail"

const ORDER: ReadonlyArray<KnowledgeModule> = ["core", ...MODULE_KEYS]

/** /knowledge/nivo: NIVO base knowledge per module, read-only for every member. */
export const NivoBrowse = async ({ items, isLoading = false }: { readonly items: ReadonlyArray<NivoItem>; /** STATE-8: the same page while its data loads - trail, heading and the first card label stay, its rows are skeletons. */ readonly isLoading?: boolean }) => {
  const t = await getT(dict)
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <div className={HEAD_CLASS}>
          <Breadcrumbs label={t("crumbLabel")} items={knowledgeTrail({ brain: t("crumbBrain"), docs: t("title") }, t("nivoTitle"))} />
          <SectionHeader level={1} title={t("nivoTitle")} description={t("nivoDescription")} />
        </div>
        {isLoading ? <SurfaceListCard label={t("moduleCore")} headingLevel={2} isLoading /> : null}
        {!isLoading && items.length === 0 ? <EmptyNotice message={t("nivoTitle")} description={t("nivoEmpty")} /> : null}
        {ORDER.map((m) => {
          const list = items.filter((i) => i.module === m)
          if (list.length === 0) return null
          return (
            <SurfaceCard key={m} label={m === "core" ? t("moduleCore") : t(`module_${m}`)} headingLevel={2}>
              <List label={m === "core" ? t("moduleCore") : t(`module_${m}`)} className={LIST_CLASS}>
                {list.map((i) => (
                  <ListItem key={i.id} className={ITEM_CLASS}>
                    <Disclosure
                      headingLevel={3}
                      title={
                        <span className={ROW_WRAP_CLASS}>
                          <Text as="span" weight="semibold" size="sm">{i.title}</Text>
                          <Badge tone="neutral">{t(`nivoKind_${i.kind}`)}</Badge>
                          <Text as="span" size="xs" tone="muted">{t("nivoVersion", { version: i.version })}</Text>
                        </span>
                      }
                    >
                      <div className={PASSAGE_TEXT_CLASS}><Text size="sm">{i.body}</Text></div>
                    </Disclosure>
                  </ListItem>
                ))}
              </List>
            </SurfaceCard>
          )
        })}
      </div>
    </PageContainer>
  )
}
