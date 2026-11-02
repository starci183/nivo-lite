import type { ChatbotCustomerWords, CustomerRowView } from "@/modules/types"
import { EmptyNotice, FilterButtonGroup, SearchField, Section, Text, type ListRowData } from "@starci/grammar/common"
type CustomerWords = ChatbotCustomerWords
/** Ready customer data, intrinsic filter values and atomic filter commands. */
interface ChatbotCustomerRowsProps {
    readonly words: CustomerWords
    readonly rows: ReadonlyArray<CustomerRowView>
    readonly query: string
    readonly filter: string
    readonly chips: ReadonlyArray<{
        readonly id: string
        readonly label: string
    }>
    readonly isFull: boolean
    readonly isLoading: boolean
    readonly onQuery: (value: string) => void
    readonly onFilter: (value: string) => void
}
/** The original customer search, filters and linked native collection. */
export const ChatbotCustomerRows = (props: ChatbotCustomerRowsProps) => {
    const words = props.words
    return (
        <>
            <SearchField
                label={words.searchLabel}
                isLabelHidden
                placeholder={words.searchPlaceholder}
                clearLabel={words.clearLabel}
                value={props.query}
                onValueChange={props.onQuery}
                isLoading={props.isLoading}
            />
            <FilterButtonGroup
                label={words.filtersLabel}
                isLoading={props.isLoading}
                options={props.chips.map((chip) => ({ value: chip.id, label: chip.label }))}
                value={props.filter}
                onValueChange={props.onFilter}
            />
            <Section
                kind="list"
                title={words.label}
                isLoading={props.isLoading}
                empty={<EmptyNotice message={words.emptyMessage} description={words.emptyDescription} />}
                items={props.rows.map((row): ListRowData => ({
                    id: row.id,
                    title: row.name,
                    description: row.summary,
                    action: { label: row.name, href: row.href },
                    badges:
                        row.stage === null
                            ? [{ label: row.status.label, tone: row.status.tone, isDot: true }]
                            : [
                                  { label: row.status.label, tone: row.status.tone, isDot: true },
                                  { label: row.stage, tone: "neutral" },
                              ],
                }))}
            />
            {props.isFull ? (
                <Text size="sm" tone="muted">
                    {words.full}
                </Text>
            ) : null}
        </>
    )
}
