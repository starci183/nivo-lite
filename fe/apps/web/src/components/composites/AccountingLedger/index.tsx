import type { ReactNode } from "react"
import { Badge, Cluster, Drawer, Stack, Text, Timeline } from "@starci/grammar/common"
import { type AccountingAdjustmentView } from "@/components/branches/AccountingAdjustment"
import { AccountingRecordList } from "@/components/leaves/AccountingRecordList"
import { AccountingSectionHead } from "@/components/branches/AccountingSectionHead"
import type { AccountingLineageItem } from "@/hooks/accounting"
import type { AccountingRecordView } from "@/hooks/accountingRecords"

/** The drawer of one ledger line: what it is, where it came from and what the member may do about it. */
interface LedgerDrawer extends AccountingAdjustmentView {
    readonly isOpen: boolean
    readonly title: string
    readonly subtitle: string | null
    readonly closeLabel: string
    readonly lineageTitle: string
    readonly lineageIntro: string
    readonly lineage: ReadonlyArray<AccountingLineageItem>
}

/** The resolved words, lines and drawer of the Ledger tab. */
interface AccountingLedgerProps {
    readonly lineage: ReactNode
    readonly adjustment: ReactNode
    readonly props: {
        readonly title: string
        readonly intro: string
        readonly foot: string
        readonly empty: string
        readonly emptyBody: string
        readonly filterLabel: string
        readonly filterItems: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly selectedFilter: string
        readonly records: ReadonlyArray<AccountingRecordView>
        readonly drawer: LedgerDrawer
    }
    readonly on: {
        readonly selectFilter: (key: string) => void
        readonly openEntry: (id: string) => void
        readonly closeDrawer: () => void
        readonly startAdjust: () => void
        readonly cancelAdjust: () => void
        readonly changeNote: (value: string) => void
        readonly changeAmount: (value: string) => void
        readonly submitAdjust: () => void
    }
    /** The panel is drawn from placeholders: its leaves draw as skeleton. */
    readonly isLoading: boolean
}

/** The ledger derived from invoices and payments, with a drawer showing where each line came from. */
export const AccountingLedger = (props: AccountingLedgerProps) => {
    const { props: data, on } = props
    const drawer = data.drawer
    const isLoading = props.isLoading
    const sectionHead = {
        title: data.title,
        intro: data.intro,
        choiceLabel: data.filterLabel,
        choices: data.filterItems,
        selectedChoice: data.selectedFilter,
        onChoose: on.selectFilter,
        isLoading,
    }
    return (
        <Stack gap="region">
            <AccountingSectionHead
                {...sectionHead}
                body={
                    <>
                        <AccountingRecordList
                            label={data.title}
                            empty={data.empty}
                            emptyBody={data.emptyBody}
                            records={data.records}
                            onOpen={on.openEntry}
                            isLoading={isLoading}
                        />
                        <Text size="xs" tone="muted" isLoading={isLoading}>
                            {data.foot}
                        </Text>
                    </>
                }
            />
            <Drawer
                isOpen={drawer.isOpen}
                onOpenChange={(open) => {
                    if (!open) on.closeDrawer()
                }}
                title={drawer.title}
                description={drawer.subtitle ?? undefined}
                closeLabel={drawer.closeLabel}
                placement="right"
            >
                <Stack gap="region">
                    {props.lineage}
                    {props.adjustment}
                </Stack>
            </Drawer>
        </Stack>
    )
}

interface AccountingLedgerLineageProps {
    readonly title: string
    readonly lineage: ReadonlyArray<AccountingLineageItem>
}
/** The existing provenance timeline stays unpainted inside the parent's named section. */
export const AccountingLedgerLineage = (props: AccountingLedgerLineageProps) => (
    <Timeline
        label={props.title}
        items={props.lineage.map((step) => ({
            id: step.id,
            title: step.title,
            ...(step.dateTime === null ? {} : { dateTime: step.dateTime }),
            ...(step.timeLabel === null ? {} : { timeLabel: step.timeLabel }),
            description: (
                <>
                    <Cluster gap="inline">
                        <Badge tone={step.isCorrection ? "accent" : "neutral"}>{step.kindLabel}</Badge>
                        {step.amountText === null ? null : <Text size="sm">{step.amountText}</Text>}
                        {step.statusText === null ? null : (
                            <Text size="xs" tone="muted">
                                {step.statusText}
                            </Text>
                        )}
                    </Cluster>
                    {step.detail === null ? null : (
                        <Text size="sm" tone="muted">
                            {step.detail}
                        </Text>
                    )}
                </>
            ),
        }))}
    />
)
