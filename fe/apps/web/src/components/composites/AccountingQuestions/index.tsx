import { EmptyNotice, Stack, Text, Section } from "@starci/grammar/common"
import { AccountingQuestionCard } from "@/components/branches/AccountingQuestionCard"
import type { AccountingQuestionCardView, AccountingQuestionsView } from "@/modules/types"

/** Atom-only question groups and addressed decision actions. */
type AccountingQuestionsProps = AccountingQuestionsView & {
    /** The groups are placeholders: their leaves draw as skeleton. */
    readonly isSkeleton: boolean
}

/** Displays the settled question groups and binds addressed actions to each pure card. */
export const AccountingQuestions = (props: AccountingQuestionsProps) => {
    if (props.props.groups.length === 0)
        return (
            <Stack gap="region">
                <Section
                    kind="list"
                    title={props.props.empty}
                    isLoading={props.isSkeleton}
                    items={[]}
                    empty={<EmptyNotice message={props.props.empty} description={props.props.emptyBody} />}
                />
            </Stack>
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
        <Stack gap="region">
            <Text size="sm" tone="muted" isLoading={props.isSkeleton}>
                {props.props.intro}
            </Text>
            {groups.map((group) => (
                <Section
                    key={group.id}
                    kind="list"
                    title={group.title}
                    count={group.items.length}
                    description={group.hint}
                    isLoading={props.isSkeleton}
                    items={group.rows.map((row) => ({
                        id: row.props.id,
                        title: row.props.title,
                        badges: [{ label: row.props.status, tone: row.props.statusTone, isDot: true }],
                        detail: <AccountingQuestionCard {...row} isLoading={props.isSkeleton} />,
                    }))}
                    empty={<EmptyNotice message={props.props.empty} description={props.props.emptyBody} />}
                />
            ))}
        </Stack>
    )
}
