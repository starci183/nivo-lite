import type { SalesPipelineView, SalesPipelineActions } from "@/modules/types"
import {
    Button,
    Cluster,
    Dialog,
    EmptyNotice,
    HorizontalScrollRegion,
    Link,
    ChoiceChips,
    Stack,
    SurfaceCard,
    Text,
    Textarea,
} from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { LANE_CLASS_NAME } from "./classNames"
/** Supplies pipeline lanes and the action for moving a deal. */
interface SalesPipelineBoardProps extends SalesPipelineView {
    readonly on: SalesPipelineActions
}
/** Surface 2: the pipeline by stage. Moving a card is always confirmed; won and lost keep the reason. */
export const SalesPipelineBoard = (props: SalesPipelineBoardProps) => {
    const on = props.on
    const dialog = props.dialog
    return (
        <>
            {renderPipelineLanes({ p: props, on })}
            <Dialog
                isOpen={dialog !== null}
                onOpenChange={(open) => {
                    if (!open) on.close()
                }}
                title={dialog?.title ?? ""}
                {...(dialog?.description === undefined ? {} : { description: dialog?.description })}
                size="md"
                closeLabel={props.cancelLabel}
                footer={
                    <>
                        <Button intent="dismiss" onPress={on.close}>
                            {props.cancelLabel}
                        </Button>
                        <Button
                            intent="commit"
                            isPending={props.isPending}
                            isDisabled={(dialog?.isIncomplete ?? true) || props.isPending}
                            onPress={on.confirm}
                        >
                            {props.confirmLabel}
                        </Button>
                    </>
                }
            >
                {dialog === null ? null : (
                    <Stack gap="row">
                        <ChoiceChips
                            label={dialog.title}
                            empty={dialog.title}
                            options={dialog.options.map((option) => ({ ...option, isDisabled: props.isPending }))}
                            value={dialog.target}
                            onValueChange={on.target}
                        />
                        {dialog.reasonLabel === null ? null : (
                            <Textarea
                                label={dialog.reasonLabel}
                                {...(dialog.reasonHint === undefined ? {} : { description: dialog.reasonHint })}
                                isRequired={dialog.reasonRequired}
                                rows={3}
                                value={dialog.reason}
                                isDisabled={props.isPending}
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
                    </Stack>
                )}
            </Dialog>
        </>
    )
}
const renderPipelineLanes = ({ p, on }: RenderPipelineLanesInput) => (
    <HorizontalScrollRegion overflow="needed" aria-label={p.label}>
        <Cluster gap="row" align="start" wrap={false}>
            {p.lanes.map((lane) => (
                <div key={lane.stage} className={LANE_CLASS_NAME}>
                    <SurfaceCard
                        kind="list"
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
                        items={lane.deals.map((deal): ListRowData => ({
                            id: deal.leadId,
                            title: deal.customer,
                            ...(deal.company === "" ? {} : { description: deal.company }),
                            ...(deal.source === null
                                ? {}
                                : { badges: [{ label: deal.source, tone: "neutral" }] as const }),
                            action: {
                                label: p.moveLabel,
                                intent: "neutral",
                                isDisabled: p.isPending,
                                press: () => on.move(deal.leadId),
                            },
                            detail: (
                                <Stack gap="identity">
                                    <Link href={deal.href}>{deal.customer}</Link>
                                    <Text size="sm" isStrong>
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
                                </Stack>
                            ),
                        }))}
                    />
                </div>
            ))}
        </Cluster>
    </HorizontalScrollRegion>
)
type RenderPipelineLanesInput = {
    p: SalesPipelineBoardProps
    on: SalesPipelineBoardProps["on"]
}
