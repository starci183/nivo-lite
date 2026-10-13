import { EmptyNotice, Region, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import { ExceptionCard } from "@/features/office/exceptions"
import type { Staff, WorkItemView } from "@/lib/flow-types"
import { BLOCK_CLASS_NAME, PANEL_CLASS_NAME, QUESTIONS_CLASS_NAME } from "./classNames"

/** One group of questions: what they are about and the waiting work items. */
interface AccountingQuestionsGroup {
    readonly id: string
    readonly title: string
    readonly hint: string
    readonly items: ReadonlyArray<WorkItemView>
}

/** The resolved words and waiting work of the Questions tab. */
interface AccountingQuestionsBaseProps {
    readonly props: {
        readonly intro: string
        readonly empty: string
        readonly emptyBody: string
        readonly groups: ReadonlyArray<AccountingQuestionsGroup>
        readonly staff: ReadonlyArray<Staff>
        readonly ownerName: string
    }
}

/**
 * The accounting work NIVO stopped on, grouped by what it is about. Each card is the existing decide card (same
 * permissions; a reconciliation still needs a written basis before a payment is confirmed).
 */
export const AccountingQuestionsBase = (props: AccountingQuestionsBaseProps) => {
    if (props.props.groups.length === 0) {
        return (
            <div className={PANEL_CLASS_NAME}>
                <SurfaceCard ariaLabel={props.props.empty}>
                    <EmptyNotice message={props.props.empty} description={props.props.emptyBody} />
                </SurfaceCard>
            </div>
        )
    }
    return (
        <div className={PANEL_CLASS_NAME}>
            <Text size="sm" tone="muted">
                {props.props.intro}
            </Text>
            {props.props.groups.map((group) => (
                <Region key={group.id} label={group.title}>
                    <div className={BLOCK_CLASS_NAME}>
                        <SectionHeader
                            level={2}
                            title={group.title}
                            count={group.items.length}
                            description={group.hint}
                        />
                        <div className={QUESTIONS_CLASS_NAME}>
                            {group.items.map((item) => (
                                <ExceptionCard
                                    key={item.id}
                                    item={item}
                                    staff={props.props.staff}
                                    ownerName={props.props.ownerName}
                                    isFocused={false}
                                />
                            ))}
                        </div>
                    </div>
                </Region>
            ))}
        </div>
    )
}
