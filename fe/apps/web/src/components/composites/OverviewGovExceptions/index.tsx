import { Badge, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import { AccountingBlock } from "@/components/branches/AccountingBlock"
import type { GovExceptionChip } from "@/hooks/overviewGov"
import { STACK_CLASS_NAME, CHIP_ROW_CLASS_NAME } from "./classNames"

/** The figures of the exceptions block. */
export interface OverviewGovExceptionsProps {
    readonly figures: {
        readonly title: string
        readonly none: string
        readonly total: string | null
        readonly chips: ReadonlyArray<GovExceptionChip>
        readonly source: string
    }
}

/** The work that stopped, by the reason NIVO gave. */
export const OverviewGovExceptions = (props: OverviewGovExceptionsProps) => (
    <AccountingBlock label={props.figures.title}>
        <SectionHeader level={2} title={props.figures.title} />
        <SurfaceCard ariaLabel={props.figures.title}>
            <div className={STACK_CLASS_NAME}>
                {props.figures.total === null ? (
                    <Text tone="muted">{props.figures.none}</Text>
                ) : (
                    <>
                        <Text weight="semibold">{props.figures.total}</Text>
                        <div className={CHIP_ROW_CLASS_NAME}>
                            {props.figures.chips.map((chip) => (
                                <Badge key={chip.id} tone={chip.tone}>
                                    {chip.label}
                                </Badge>
                            ))}
                        </div>
                    </>
                )}
                <Text size="xs" tone="muted">
                    {props.figures.source}
                </Text>
            </div>
        </SurfaceCard>
    </AccountingBlock>
)
