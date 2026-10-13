import { Badge, EmptyNotice, ListRow, SurfaceListCard, Text, TextAction } from "@starci/grammar/common"
import { KNOWLEDGE_ROUTES } from "@/modules/routes"
import type { DashboardKnowledge } from "@/modules/types"
import { LABEL_END_CLASS_NAME } from "./classNames"
import { RegionFailed } from "./shared"
import type { RegionProps } from "./shared"

/** What the agent can read (public and internal) and, when the data exists, the questions it could not answer. */
export const KnowledgeRegion = (props: RegionProps<DashboardKnowledge>) => {
    const { region, isLoading, view, retry } = props
    const t = view.t
    const label = t("knowTitle")
    if (isLoading || !region) return <SurfaceListCard label={label} isLoading />
    if (region.status === "failed") return <RegionFailed label={label} view={view} retry={retry} />
    const k = region.data
    const isInternal = k.audience === "internal"
    const gaps = k.gaps
    return (
        <>
            <SurfaceListCard
                label={label}
                labelEnd={
                    <TextAction size="sm" href={KNOWLEDGE_ROUTES.library}>
                        {t("knowOpen")}
                    </TextAction>
                }
                footer={
                    <Text size="sm" tone="muted">
                        {isInternal ? t("knowAudienceInternal") : t("knowAudienceCustomer")}
                    </Text>
                }
            >
                <ListRow
                    title={t("knowPublic")}
                    description={t("knowCounts", { docs: k.documents.public, facts: k.facts.public })}
                />
                <ListRow
                    title={t("knowInternal")}
                    description={
                        isInternal
                            ? [
                                  t("knowCounts", { docs: k.documents.internal, facts: k.facts.internal }),
                                  k.facts.restricted > 0 ? t("knowRestricted", { n: k.facts.restricted }) : "",
                              ]
                                  .filter(Boolean)
                                  .join(" · ")
                            : t("knowInternalOff")
                    }
                />
            </SurfaceListCard>
            {gaps ? (
                <SurfaceListCard
                    label={t("gapsTitle")}
                    labelEnd={
                        gaps.openCount > 0 ? (
                            <div className={LABEL_END_CLASS_NAME}>
                                <Badge tone="warning" isDot>
                                    {String(gaps.openCount)}
                                </Badge>
                                <TextAction size="sm" href={KNOWLEDGE_ROUTES.library}>
                                    {t("gapsOpen")}
                                </TextAction>
                            </div>
                        ) : undefined
                    }
                    empty={<EmptyNotice message={t("gapsEmpty")} description={t("gapsEmptyBody")} />}
                >
                    {gaps.items.map((g) => (
                        <ListRow
                            key={g.id}
                            title={g.question}
                            description={view.when(g.lastSeenAt)}
                            badges={<Badge tone="warning">{t("gapAsked", { n: g.count })}</Badge>}
                        />
                    ))}
                </SurfaceListCard>
            ) : null}
        </>
    )
}
