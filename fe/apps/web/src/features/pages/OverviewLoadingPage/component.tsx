import { Button, Grid, Page, EmptyNotice, Section, Stack, SurfaceCard, Text } from "@starci/grammar/common"

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
        readonly description: string
        readonly actionLabel: string
        readonly emptyMessage: string
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
        isLoading
        header={{
            title: props.props.eyebrow,
            meta: props.props.eyebrow,
            description: props.props.description,
            actions: (
                <Button intent="neutral" isLoading>
                    {props.props.actionLabel}
                </Button>
            ),
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
                            <Text isLoading>{block.title}</Text>
                        </Stack>
                    </SurfaceCard>
                ))}
            </Stack>
            <Section title={props.props.ownerBelowTitle}>
                <Grid kind="cards" columns={2}>
                    <SurfaceCard
                        kind="figures"
                        ariaLabel={props.props.kpiLabel}
                        isLoading
                        items={props.props.kpiLabels
                            .slice(0, 3)
                            .map((label) => ({ id: label, term: label, value: "" }))}
                    />
                    <SurfaceCard
                        kind="figures"
                        ariaLabel={props.props.kpiLabel}
                        isLoading
                        items={props.props.kpiLabels.slice(3).map((label) => ({ id: label, term: label, value: "" }))}
                    />
                </Grid>
                <SurfaceCard
                    kind="list"
                    label={props.props.byOwnerTitle}
                    isLoading
                    empty={<EmptyNotice message={props.props.emptyMessage} />}
                    items={[]}
                />
            </Section>
        </Stack>
    </Page>
)
