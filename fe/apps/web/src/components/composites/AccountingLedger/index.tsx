import { Badge, Drawer, SectionHeader, Text, Timeline } from "@starci/grammar/common"
import { AccountingBlock } from "@/components/leaves/AccountingBlock"
import { AccountingAdjustment, type AccountingAdjustmentView } from "@/components/branches/AccountingAdjustment"
import { AccountingRecordList } from "@/components/leaves/AccountingRecordList"
import { AccountingSectionHead } from "@/components/branches/AccountingSectionHead"
import type { AccountingLineageItem } from "@/hooks/accounting"
import type { AccountingRecordView } from "@/hooks/accountingRecords"
import { CHIPS_CLASS_NAME, DRAWER_BODY_CLASS_NAME, PANEL_CLASS_NAME } from "./classNames"

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
    readonly isSkeleton: boolean
}

/** The ledger derived from invoices and payments, with a drawer showing where each line came from. */
export const AccountingLedger = (props: AccountingLedgerProps) => {
    const { props: data, on } = props
    const drawer = data.drawer
    const isSkeleton = props.isSkeleton
    const sectionHead = {
        title: data.title,
        intro: data.intro,
        choiceLabel: data.filterLabel,
        choices: data.filterItems,
        selectedChoice: data.selectedFilter,
        onChoose: on.selectFilter,
        isSkeleton,
    }
    return (
        <div className={PANEL_CLASS_NAME}>
            <AccountingSectionHead {...sectionHead}>
                <AccountingRecordList
                    label={data.title}
                    empty={data.empty}
                    emptyBody={data.emptyBody}
                    records={data.records}
                    onOpen={on.openEntry}
                    isSkeleton={isSkeleton}
                />
                <Text size="xs" tone="muted" isSkeleton={isSkeleton}>
                    {data.foot}
                </Text>
            </AccountingSectionHead>
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
                <div className={DRAWER_BODY_CLASS_NAME}>
                    <AccountingBlock label={drawer.lineageTitle}>
                        <SectionHeader level={3} title={drawer.lineageTitle} description={drawer.lineageIntro} />
                        <Timeline
                            label={drawer.lineageTitle}
                            items={drawer.lineage.map((step) => ({
                                id: step.id,
                                title: step.title,
                                ...(step.dateTime === null ? {} : { dateTime: step.dateTime }),
                                ...(step.timeLabel === null ? {} : { timeLabel: step.timeLabel }),
                                description: (
                                    <>
                                        <div className={CHIPS_CLASS_NAME}>
                                            <Badge tone={step.isCorrection ? "accent" : "neutral"}>
                                                {step.kindLabel}
                                            </Badge>
                                            {step.amountText === null ? null : <Text size="sm">{step.amountText}</Text>}
                                            {step.statusText === null ? null : (
                                                <Text size="xs" tone="muted">
                                                    {step.statusText}
                                                </Text>
                                            )}
                                        </div>
                                        {step.detail === null ? null : (
                                            <Text size="sm" tone="muted">
                                                {step.detail}
                                            </Text>
                                        )}
                                    </>
                                ),
                            }))}
                        />
                    </AccountingBlock>
                    <AccountingBlock label={drawer.adjustTitle}>
                        <SectionHeader level={3} title={drawer.adjustTitle} />
                        <AccountingAdjustment props={drawer} on={on} />
                    </AccountingBlock>
                </div>
            </Drawer>
        </div>
    )
}

/** The settled atoms of the AccountingLedger surface. */
export type AccountingLedgerView = AccountingLedgerProps["props"]

/** What the ledger does, handed in by its panel. */
export type AccountingLedgerOn = AccountingLedgerProps["on"]
