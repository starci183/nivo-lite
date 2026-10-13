import { Alert, Badge, EmptyNotice, ListRow, SurfaceListCard, Text, TextAction } from "@starci/grammar/common"
import type { ReactElement } from "react"
import { KNOWLEDGE_ROUTES } from "@/modules/routes"
import type { DashboardKnowledge, DashboardRegion } from "@/modules/types"
import { LABEL_END_CLASS_NAME } from "./classNames"

/** The translator and the timestamp format of the regions, resolved by the connected owner. */
export interface WorkbenchRegionsView {
    readonly t: (key: string, values?: Record<string, string | number>) => string
    readonly when: (iso: string | null | undefined) => string
}

/** What one region needs besides its own data. */
export interface RegionProps<T> {
    readonly region: DashboardRegion<T> | undefined
    readonly isLoading: boolean
    readonly view: WorkbenchRegionsView
    readonly retry: () => void
}

/** What a region that could not be read shows. */
interface RegionFailedProps {
    readonly label: string
    readonly view: WorkbenchRegionsView
    readonly retry: () => void
}

/** A region that could not be read fails in place: one negative Alert with a retry, the rest of the page stays. */
const RegionFailed = (props: RegionFailedProps) => (
    <Alert
        tone="negative"
        title={props.view.t("regionFailed")}
        description={`${props.label}. ${props.view.t("regionFailedText")}`}
        action={{ label: props.view.t("retry"), onAction: props.retry }}
    />
)

/** What a region draws before its data is there: the loading card, or the failure in place; `undefined` once it has data. */
export const regionFallback = <T,>(props: RegionProps<T>, label: string): ReactElement | undefined => {
    if (props.isLoading || !props.region) return <SurfaceListCard label={label} isLoading />
    if (props.region.status === "failed") return <RegionFailed label={label} view={props.view} retry={props.retry} />
    return undefined
}

/** What the knowledge region draws: the knowledge of the agent, or why it is not there. */
export interface KnowledgeRegionProps {
    readonly region: DashboardRegion<DashboardKnowledge> | undefined
    readonly isLoading: boolean
    readonly view: WorkbenchRegionsView
    readonly retry: () => void
}

/** What the agent can read (public and internal) and, when the data exists, the questions it could not answer. */
export const KnowledgeRegion = (props: KnowledgeRegionProps) => {
    const { region, view } = props
    const t = view.t
    const fallback = regionFallback(props, t("knowTitle"))
    if (fallback || region?.status !== "ready") return fallback
    const label = t("knowTitle")
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
