import {
    Button,
    Grid,
    Page,
    SectionHeader,
    Skeleton,
    Stack,
    SurfaceCard,
    SurfaceListCard,
    Text,
} from "@starci/grammar/common"
import { AccountingBlock } from "@/components/branches/AccountingBlock"

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
    <Page
        measure="product"
        isSkeleton
        header={{
            title: "-",
            meta: props.props.eyebrow,
            description: "-",
            actions: <Button intent="neutral">-</Button>,
        }}
    >
        <Stack gap="section">
            <Stack gap="row">
                {props.props.blocks.map((block) => (
                    <SurfaceCard key={block.id} label={block.title} headingLevel={2}>
                        <Stack gap="row">
                            {block.description === null ? null : (
                                <Text size="sm" tone="muted">
                                    {block.description}
                                </Text>
                            )}
                            <Skeleton shape="text" lines={block.lines} />
                        </Stack>
                    </SurfaceCard>
                ))}
            </Stack>
            <SectionHeader level={2} title={props.props.ownerBelowTitle} />
            <AccountingBlock label={props.props.kpiLabel}>
                <Grid kind="cards">
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
                </Grid>
            </AccountingBlock>
            <SurfaceListCard label={props.props.byOwnerTitle} isLoading />
        </Stack>
    </Page>
)
