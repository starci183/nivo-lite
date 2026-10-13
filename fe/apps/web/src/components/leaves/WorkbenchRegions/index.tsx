import {
    Badge,
    Button,
    EmptyNotice,
    ListRow,
    SurfaceListCard,
    Text,
    TextAction,
    type BadgeTone,
} from "@starci/grammar/common"
import { CONSOLE_ROUTES, policyLogHref } from "@/modules/routes"
import type {
    AgentDashboardView,
    DashboardConnection,
    DashboardDone,
    DashboardRow,
    DashboardWaiting,
} from "@/modules/types"
import { LABEL_END_CLASS_NAME, SIDE_COLUMN_CLASS_NAME, SIDE_GRID_CLASS_NAME } from "./classNames"
import { KnowledgeRegion } from "./KnowledgeRegion"
import { RegionFailed } from "./shared"
import type { RegionProps, WorkbenchRegionsView } from "./shared"

/** What the four common regions of a workbench draw. */
interface WorkbenchRegionsProps {
    readonly module: string
    readonly data?: AgentDashboardView
    readonly isLoading: boolean
    readonly retry: () => void
    readonly view: WorkbenchRegionsView
}

const rowDescription = (item: DashboardRow, when: string): string =>
    [item.description, when].filter(Boolean).join(" · ")

/** The decisions of this module that wait for a person, each linking to the decision. */
const WaitingRegion = ({ region, isLoading, view, retry }: RegionProps<DashboardWaiting>) => {
    const t = view.t
    const label = t("waitingTitle")
    if (isLoading || !region) return <SurfaceListCard label={label} isLoading />
    if (region.status === "failed") return <RegionFailed label={label} view={view} retry={retry} />
    const { total, items } = region.data
    return (
        <SurfaceListCard
            label={label}
            labelEnd={
                total > 0 ? (
                    <Badge tone="warning" isDot>
                        {String(total)}
                    </Badge>
                ) : undefined
            }
            empty={<EmptyNotice message={t("waitingEmpty")} description={t("waitingEmptyBody")} />}
            footer={
                total > items.length ? (
                    <Text size="sm" tone="muted">
                        {t("waitingMore", { n: total - items.length })}
                    </Text>
                ) : undefined
            }
        >
            {items.map((item) => (
                <ListRow
                    key={item.id}
                    title={item.title}
                    description={rowDescription(item, view.when(item.at))}
                    actions={
                        <Button size="sm" variant="secondary" href={item.href}>
                            {t("waitingOpen")}
                        </Button>
                    }
                />
            ))}
        </SurfaceListCard>
    )
}

/** What the done region needs besides the common region props. */
interface DoneRegionProps extends RegionProps<DashboardDone> {
    readonly module: string
}

/** How much the agent finished within the owner's rules over the last seven days, and the last few items. */
const DoneRegion = ({ region, isLoading, module, view, retry }: DoneRegionProps) => {
    const t = view.t
    const label = t("doneTitle")
    if (isLoading || !region) return <SurfaceListCard label={label} isLoading />
    if (region.status === "failed") return <RegionFailed label={label} view={view} retry={retry} />
    const { count, items } = region.data
    return (
        <SurfaceListCard
            label={label}
            labelEnd={
                <div className={LABEL_END_CLASS_NAME}>
                    <Badge tone="success" isDot>
                        {t("doneCount", { n: count })}
                    </Badge>
                    <TextAction size="sm" href={policyLogHref(module)}>
                        {t("doneLog")}
                    </TextAction>
                </div>
            }
            empty={<EmptyNotice message={t("doneEmpty")} description={t("doneEmptyBody")} />}
        >
            {items.map((item) => (
                <ListRow
                    key={item.id}
                    title={
                        <TextAction appearance="plain" href={item.href}>
                            {item.title}
                        </TextAction>
                    }
                    description={rowDescription(item, view.when(item.at))}
                />
            ))}
        </SurfaceListCard>
    )
}

const STATUS_TONE: Record<DashboardConnection["status"], BadgeTone> = {
    connected: "success",
    error: "danger",
    pending: "neutral",
}

/** The connections bound to this agent, their status and what the agent may do through each. */
const ConnectionsRegion = ({ region, isLoading, view, retry }: RegionProps<ReadonlyArray<DashboardConnection>>) => {
    const t = view.t
    const label = t("connTitle")
    if (isLoading || !region) return <SurfaceListCard label={label} isLoading />
    if (region.status === "failed") return <RegionFailed label={label} view={view} retry={retry} />
    return (
        <SurfaceListCard
            label={label}
            labelEnd={
                <TextAction size="sm" href={CONSOLE_ROUTES.connections}>
                    {t("connManage")}
                </TextAction>
            }
            empty={<EmptyNotice message={t("connEmpty")} description={t("connEmptyBody")} />}
        >
            {region.data.map((c) => (
                <ListRow
                    key={c.id}
                    title={c.name}
                    description={`${c.providerLabel} · ${t(`connPurpose_${c.purpose}`)}`}
                    badges={
                        <>
                            <Badge tone={STATUS_TONE[c.status]} isDot>
                                {t(`connStatus_${c.status}`)}
                            </Badge>
                            <Badge tone="neutral">{t(`connAccess_${c.access}`)}</Badge>
                        </>
                    }
                />
            ))}
        </SurfaceListCard>
    )
}

/** Draws the independent waiting, done, connection and knowledge regions. */
export const WorkbenchRegions = (props: WorkbenchRegionsProps) => {
    const common = { isLoading: props.isLoading, view: props.view, retry: props.retry }
    return (
        <>
            <WaitingRegion region={props.data?.waiting} {...common} />
            <div className={SIDE_GRID_CLASS_NAME}>
                <DoneRegion region={props.data?.done} module={props.module} {...common} />
                <ConnectionsRegion region={props.data?.connections} {...common} />
                <div className={SIDE_COLUMN_CLASS_NAME}>
                    <KnowledgeRegion region={props.data?.knowledge} {...common} />
                </div>
            </div>
        </>
    )
}
