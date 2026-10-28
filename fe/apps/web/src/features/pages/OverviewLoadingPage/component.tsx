import {
    Button,
    PageContainer,
    PageHeader,
    SectionHeader,
    Skeleton,
    SurfaceCard,
    SurfaceListCard,
    Text,
} from "@starci/grammar/common"
import { AccountingBlock } from "@/components/branches/AccountingBlock"
import { KPI_GRID_CLASS_NAME, PAGE_CLASS_NAME, PAGE_INSET_CLASS_NAME } from "./classNames"

/** A block that keeps its heading while its content loads. */
interface OverviewLoadingBlock {
    readonly id: string
    readonly title: string
    readonly description: string | null
    readonly lines: number
}

/** The words that stay real while the overview loads. */
interface OverviewLoadingPageBaseProps {
    readonly props: {
        readonly eyebrow: string
        readonly blocks: ReadonlyArray<OverviewLoadingBlock>
        readonly ownerBelowTitle: string
        readonly kpiLabel: string
        readonly kpiLabels: ReadonlyArray<string>
        readonly byOwnerTitle: string
        readonly listLabel: string
    }
}

/** The overview with no data yet: the same headings, KPI cards and owner list, every figure and row a skeleton. */
export const OverviewLoadingPageBase = (props: OverviewLoadingPageBaseProps) => (
    <>
        <PageHeader
            measure="product"
            title="-"
            meta={props.props.eyebrow}
            description="-"
            isSkeleton
            actions={<Button intent="neutral">-</Button>}
        />
        <PageContainer measure="product">
            <div className={PAGE_INSET_CLASS_NAME}>
                <div className={PAGE_CLASS_NAME}>
                    {props.props.blocks.map((block) => (
                        <AccountingBlock key={block.id} label={block.title}>
                            <SectionHeader level={2} title={block.title} description={block.description ?? undefined} />
                            <SurfaceCard ariaLabel={block.title}>
                                <Skeleton shape="text" lines={block.lines} />
                            </SurfaceCard>
                        </AccountingBlock>
                    ))}
                    <SectionHeader level={2} title={props.props.ownerBelowTitle} />
                    <AccountingBlock label={props.props.kpiLabel}>
                        <div className={KPI_GRID_CLASS_NAME}>
                            {props.props.kpiLabels.map((label) => (
                                <SurfaceCard key={label} ariaLabel={label}>
                                    <Text size="xs" tone="muted">
                                        {label}
                                    </Text>
                                    <Text size="metric-lead" weight="semibold" isSkeleton>
                                        0
                                    </Text>
                                </SurfaceCard>
                            ))}
                        </div>
                    </AccountingBlock>
                    <SectionHeader level={2} title={props.props.byOwnerTitle} />
                    <SurfaceListCard ariaLabel={props.props.listLabel} isLoading />
                </div>
            </div>
        </PageContainer>
    </>
)
