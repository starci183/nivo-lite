import { Button, NumberField, Textarea, Grid } from "@starci/grammar/common"
import { AuthoritySection } from "@/components/frames/AuthoritySection"
import type { AuthoritySectionView } from "@/components/frames/AuthoritySection"
import { SlotView } from "@nivo/agent-sdk/workbench"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Copy, values and state of the goals section. */
export interface AuthorityGoalsBaseProps {
    readonly props: {
        readonly section: AuthoritySectionView
        readonly revenueLabel: string
        readonly revenueHint: string
        readonly customersLabel: string
        readonly replyLabel: string
        readonly noteLabel: string
        readonly noteHint: string
        readonly slot: DataSlot<boolean>
        readonly slotLabels: SlotLabels
        readonly revenue: number
        readonly customers: number
        readonly reply: number
        readonly note: string
    }
    readonly on: {
        readonly revenue: (value: number) => void
        readonly customers: (value: number) => void
        readonly reply: (value: number) => void
        readonly note: (value: string) => void
        readonly save: () => void
        readonly retry: () => void
    }
}

const WHOLE = { maximumFractionDigits: 0 }

/** Draws the goals section: revenue, new customers and first-reply targets with a note. */
export const AuthorityGoalsBase = (props: AuthorityGoalsBaseProps) => {
    const view = props.props
    return (
        <SlotView
            slot={view.slot}
            placeholder={false}
            labels={view.slotLabels}
            onRetry={props.on.retry}
            render={(_, isSkeleton) => (
                <AuthoritySection
                    section={view.section}
                    footer={
                        <Button
                            intent="commit"
                            isPending={view.section.isPending}
                            isLoading={isSkeleton}
                            onPress={props.on.save}
                        >
                            {view.section.saveLabel}
                        </Button>
                    }
                >
                    <Grid kind="form" columns={2}>
                        <NumberField
                            isLoading={isSkeleton}
                            label={view.revenueLabel}
                            description={view.revenueHint}
                            minValue={0}
                            step={1_000_000}
                            formatOptions={WHOLE}
                            value={view.revenue}
                            onValueChange={props.on.revenue}
                        />
                        <NumberField
                            isLoading={isSkeleton}
                            label={view.customersLabel}
                            minValue={0}
                            step={1}
                            formatOptions={WHOLE}
                            value={view.customers}
                            onValueChange={props.on.customers}
                        />
                        <NumberField
                            isLoading={isSkeleton}
                            label={view.replyLabel}
                            minValue={1}
                            step={1}
                            formatOptions={WHOLE}
                            value={view.reply}
                            onValueChange={props.on.reply}
                        />
                    </Grid>
                    <Textarea
                        isLoading={isSkeleton}
                        label={view.noteLabel}
                        description={view.noteHint}
                        rows={2}
                        value={view.note}
                        onValueChange={props.on.note}
                    />
                </AuthoritySection>
            )}
        />
    )
}
