import type { LeadStageId } from "@/modules/types"
import type { useTranslations, useFormatter } from "next-intl"
import type { useLeadCommands } from "@/hooks/leads"
import type { useSalesActions } from "@/hooks/sales"
import type { useSalesWorkbench } from "@/hooks/salesworkbench"
import type { useSalesPipelineForm } from "@/hooks/rhf"
import {
    Badge,
    Button,
    Dialog,
    EmptyNotice,
    HorizontalScrollRegion,
    ListRow,
    SegmentedControl,
    SurfaceListCard,
    Text,
    TextAction,
    Textarea,
} from "@starci/grammar/common"
import { BOARD_CLASS_NAME, DETAIL_CLASS_NAME, FORM_CLASS_NAME, LANE_CLASS_NAME } from "./classNames"

/** One deal card, every word already resolved. */
export interface DealView {
    readonly leadId: string
    readonly href: string
    readonly customer: string
    readonly company: string
    readonly value: string
    readonly source: string | null
    readonly nextLine: string
    readonly isClosed: boolean
    readonly facts: string
}

/** One stage lane. */
export interface LaneView {
    readonly stage: string
    readonly title: string
    readonly fact: string
    readonly hiddenText: string | null
    readonly deals: ReadonlyArray<DealView>
}

/** The dialog that moves a deal to another stage. */
export interface MoveDialogView {
    readonly title: string
    readonly description: string | undefined
    readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>
    readonly target: string
    readonly isDanger: boolean
    readonly reasonLabel: string | null
    readonly reasonHint: string | undefined
    readonly reasonRequired: boolean
    readonly reason: string
    readonly wonNote: string | null
    readonly error: string | null
    readonly isIncomplete: boolean
}

/** The words and data of the pipeline surface. */
export interface SalesPipelineBaseProps {
    readonly props: {
        readonly label: string
        readonly lanes: ReadonlyArray<LaneView>
        readonly emptyText: string
        readonly moveLabel: string
        readonly cancelLabel: string
        readonly confirmLabel: string
        readonly dialog: MoveDialogView | null
        readonly isPending: boolean
    }
    readonly on: {
        readonly move: (leadId: string) => void
        readonly target: (value: string) => void
        readonly reason: (value: string) => void
        readonly confirm: () => void
        readonly close: () => void
    }
}

/** Surface 2: the pipeline by stage. Moving a card is always confirmed; won and lost keep the reason. */
export const SalesPipelineBase = (props: SalesPipelineBaseProps) => {
    const { props: p, on } = props
    const dialog = p.dialog
    return (
        <>
            {renderPipelineLanes({ p, on })}
            <Dialog
                isOpen={dialog !== null}
                onOpenChange={(open) => {
                    if (!open) on.close()
                }}
                title={dialog?.title ?? ""}
                description={dialog?.description}
                size="md"
                closeLabel={p.cancelLabel}
                footer={
                    <>
                        <Button intent="dismiss" onPress={on.close}>
                            {p.cancelLabel}
                        </Button>
                        <Button
                            intent="commit"
                            isPending={p.isPending}
                            isDisabled={(dialog?.isIncomplete ?? true) || p.isPending}
                            onPress={on.confirm}
                        >
                            {p.confirmLabel}
                        </Button>
                    </>
                }
            >
                {dialog === null ? null : (
                    <div className={FORM_CLASS_NAME}>
                        <SegmentedControl
                            label={dialog.title}
                            options={dialog.options}
                            value={dialog.target}
                            isDisabled={p.isPending}
                            onValueChange={on.target}
                        />
                        {dialog.reasonLabel === null ? null : (
                            <Textarea
                                label={dialog.reasonLabel}
                                description={dialog.reasonHint}
                                isRequired={dialog.reasonRequired}
                                rows={3}
                                value={dialog.reason}
                                isDisabled={p.isPending}
                                onValueChange={on.reason}
                            />
                        )}
                        {dialog.wonNote === null ? null : (
                            <Text size="sm" tone="muted">
                                {dialog.wonNote}
                            </Text>
                        )}
                        {dialog.error === null ? null : (
                            <Text size="sm" live="assertive">
                                {dialog.error}
                            </Text>
                        )}
                    </div>
                )}
            </Dialog>
        </>
    )
}

const renderPipelineLanes = ({ p, on }: RenderPipelineLanesInput) => (
    <HorizontalScrollRegion overflow="needed" aria-label={p.label}>
        <div className={BOARD_CLASS_NAME}>
            {p.lanes.map((lane) => (
                <div key={lane.stage} className={LANE_CLASS_NAME}>
                    <SurfaceListCard
                        label={lane.title}
                        fact={lane.fact}
                        empty={<EmptyNotice message={p.emptyText} />}
                        footer={
                            lane.hiddenText === null ? undefined : (
                                <Text size="xs" tone="muted">
                                    {lane.hiddenText}
                                </Text>
                            )
                        }
                    >
                        {lane.deals.map((deal) => (
                            <ListRow
                                key={deal.leadId}
                                title={<TextAction href={deal.href}>{deal.customer}</TextAction>}
                                description={deal.company === "" ? null : deal.company}
                                badges={deal.source === null ? null : <Badge tone="neutral">{deal.source}</Badge>}
                                actions={
                                    <Button
                                        intent="dismiss"
                                        size="sm"
                                        isDisabled={p.isPending}
                                        onPress={() => on.move(deal.leadId)}
                                    >
                                        {p.moveLabel}
                                    </Button>
                                }
                            >
                                <div className={DETAIL_CLASS_NAME}>
                                    <Text size="sm" weight="semibold">
                                        {deal.value}
                                    </Text>
                                    <Text
                                        size="sm"
                                        {...(deal.isClosed ? { tone: "muted" as const } : {})}
                                        overflow="clamp-2"
                                    >
                                        {deal.nextLine}
                                    </Text>
                                    <Text size="xs" tone="muted">
                                        {deal.facts}
                                    </Text>
                                </div>
                            </ListRow>
                        ))}
                    </SurfaceListCard>
                </div>
            ))}
        </div>
    </HorizontalScrollRegion>
)

type RenderPipelineLanesInput = { p: SalesPipelineBaseProps["props"]; on: SalesPipelineBaseProps["on"] }
/** State values and commands consumed by the connected surface. */
export type SalesPipelineControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"workbenchSales">>
    readonly format: ReturnType<typeof useFormatter>
    readonly commands: ReturnType<typeof useLeadCommands>
    readonly actions: ReturnType<typeof useSalesActions>
    readonly data: ReturnType<typeof useSalesWorkbench>["data"]
    readonly deals: NonNullable<NonNullable<ReturnType<typeof useSalesWorkbench>["data"]>["deals"]>
    readonly closedHidden: NonNullable<NonNullable<ReturnType<typeof useSalesWorkbench>["data"]>["closedHidden"]>
    readonly form: ReturnType<typeof useSalesPipelineForm>
    readonly selectedTarget: LeadStageId | ""
    readonly reason: string
    readonly target: LeadStageId | null
    readonly isPending: boolean
    readonly movingId: string | null
    readonly setMovingId: React.Dispatch<React.SetStateAction<string | null>>
}
