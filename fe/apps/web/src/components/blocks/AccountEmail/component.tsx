import { DescriptionList, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { FORM_CLASS_NAME } from "./classNames"

/** Copy and values the connected email card supplies. */
export interface AccountEmailBaseProps {
    readonly props: {
        readonly title: string
        readonly currentLabel: string
        /** The address of the account, once the read arrived. */
        readonly slot: DataSlot<string>
        readonly labels: SlotLabels
        readonly hint: string
    }
    readonly on: {
        readonly retry: () => void
    }
}

/** Draws the email card: the current sign-in address (changing it is not offered yet). */
export const AccountEmailBase = (props: AccountEmailBaseProps) => (
    <SlotView slot={props.props.slot} placeholder="" labels={props.props.labels} onRetry={props.on.retry}>
        {(email, isSkeleton) => (
            <SurfaceCard label={props.props.title} headingLevel={2}>
                <div className={FORM_CLASS_NAME}>
                    <DescriptionList
                        layout="stacked"
                        isLoading={isSkeleton}
                        items={[
                            {
                                id: "email",
                                term: props.props.currentLabel,
                                description: <Text weight="medium">{email}</Text>,
                            },
                        ]}
                    />
                    <Text size="sm" tone="muted">
                        {props.props.hint}
                    </Text>
                </div>
            </SurfaceCard>
        )}
    </SlotView>
)
