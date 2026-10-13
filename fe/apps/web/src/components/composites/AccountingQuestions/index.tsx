import { EmptyNotice, Region, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import { AccountingQuestionCard } from "@/components/branches/AccountingQuestionCard"
import type { AccountingQuestionCardView, AccountingQuestionsView } from "@/modules/types"
import { CARDS_CLASS_NAME, GROUP_CLASS_NAME, PANEL_CLASS_NAME } from "./classNames"

/** Atom-only question groups and addressed decision actions. */
type AccountingQuestionsProps = AccountingQuestionsView

/** Displays the settled question groups and binds addressed actions to each pure card. */
export const AccountingQuestions = (props: AccountingQuestionsProps) => {
    if (props.props.groups.length === 0)
        return (
            <div className={PANEL_CLASS_NAME}>
                <SurfaceCard ariaLabel={props.props.empty}>
                    <EmptyNotice message={props.props.empty} description={props.props.emptyBody} />
                </SurfaceCard>
            </div>
        )
    const groups = props.props.groups.map((group) => ({
        ...group,
        rows: group.items.map<AccountingQuestionCardView>((item) => ({
            props: item,
            on: {
                approve: () => props.on.approve(item.id),
                reject: () => props.on.reject(item.id),
                toggleEdit: () => props.on.toggleEdit(item.id),
                changeDraft: (value) => props.on.changeDraft(item.id, value),
                changeAmount: (value) => props.on.changeAmount(item.id, value),
                changeBasis: (value) => props.on.changeBasis(item.id, value),
                changeCandidate: (value) => props.on.changeCandidate(item.id, value),
                changeField: (name, value) => props.on.changeField(item.id, name, value),
            },
        })),
    }))
    return (
        <div className={PANEL_CLASS_NAME}>
            <Text size="sm" tone="muted">
                {props.props.intro}
            </Text>
            {groups.map((group) => (
                <Region key={group.id} label={group.title}>
                    <div className={GROUP_CLASS_NAME}>
                        <SectionHeader
                            level={2}
                            title={group.title}
                            count={group.items.length}
                            description={group.hint}
                        />
                        <div className={CARDS_CLASS_NAME}>
                            {group.rows.map((row) => (
                                <AccountingQuestionCard key={row.props.id} props={row.props} on={row.on} />
                            ))}
                        </div>
                    </div>
                </Region>
            ))}
        </div>
    )
}
