import {
    Alert,
    Badge,
    Button,
    Drawer,
    Form,
    Input,
    SectionHeader,
    Text,
    Textarea,
    Timeline,
} from "@starci/grammar/common"
import { AccountingBlock } from "@/components/composites/AccountingBlock"
import { AccountingFormActions } from "@/components/composites/AccountingFormActions"
import { AccountingRecordList } from "@/components/composites/AccountingRecordList"
import { AccountingSectionHead } from "@/components/composites/AccountingSectionHead"
import type { AccountingLineageItem } from "@/hooks/accounting"
import type { AccountingRecordView } from "@/hooks/accountingRecords"
import {
    BLOCK_CLASS_NAME,
    CHIPS_CLASS_NAME,
    DRAWER_BODY_CLASS_NAME,
    FORM_ACTIONS_CLASS_NAME,
    PANEL_CLASS_NAME,
} from "./classNames"

/** The correction form: words and values. */
interface LedgerAdjustForm {
    readonly intro: string
    readonly noteLabel: string
    readonly noteHint: string
    readonly amountLabel: string
    readonly amountHint: string
    readonly saveLabel: string
    readonly cancelLabel: string
    readonly note: string
    readonly amount: string
    readonly isSaving: boolean
    readonly error: string | null
}

/** The drawer of one ledger line: what it is, where it came from and what the member may do about it. */
interface LedgerDrawer {
    readonly isOpen: boolean
    readonly title: string
    readonly subtitle: string | null
    readonly closeLabel: string
    readonly lineageTitle: string
    readonly lineageIntro: string
    readonly lineage: ReadonlyArray<AccountingLineageItem>
    readonly adjustTitle: string
    readonly adjustMode: "notReady" | "managersOnly" | "form" | "button"
    readonly notReadyText: string
    readonly managersOnlyText: string
    readonly openLabel: string
    readonly form: LedgerAdjustForm
}

/** The resolved words, lines and drawer of the Ledger tab. */
interface AccountingLedgerBaseProps {
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
}

/** The correction part of the drawer. */
interface AdjustSectionProps {
    readonly drawer: LedgerDrawer
    readonly on: AccountingLedgerBaseProps["on"]
}

/** The correction form: a note about why, an optional amount, save and cancel. */
const AdjustForm = (props: AdjustSectionProps) => {
    const form = props.drawer.form
    return (
        <Form label={props.drawer.adjustTitle} isPending={form.isSaving} onSubmit={props.on.submitAdjust}>
            <div className={BLOCK_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {form.intro}
                </Text>
                <Textarea
                    id="wb-adj-note"
                    name="note"
                    label={form.noteLabel}
                    variant="secondary"
                    rows={3}
                    value={form.note}
                    isRequired
                    isDisabled={form.isSaving}
                    description={form.noteHint}
                    onValueChange={props.on.changeNote}
                />
                <Input
                    id="wb-adj-amount"
                    name="amount"
                    label={form.amountLabel}
                    variant="secondary"
                    value={form.amount}
                    isDisabled={form.isSaving}
                    hint={form.amountHint}
                    onValueChange={props.on.changeAmount}
                />
                {form.error === null ? null : <Alert tone="negative" title={form.error} />}
                <AccountingFormActions
                    cancelLabel={form.cancelLabel}
                    saveLabel={form.saveLabel}
                    isSaving={form.isSaving}
                    onCancel={props.on.cancelAdjust}
                />
            </div>
        </Form>
    )
}

/** Notes, form or the button that opens the form, by what the member may do. */
const AdjustSection = (props: AdjustSectionProps) => {
    const drawer = props.drawer
    if (drawer.adjustMode === "notReady") {
        return (
            <Text size="sm" tone="muted">
                {drawer.notReadyText}
            </Text>
        )
    }
    if (drawer.adjustMode === "managersOnly") {
        return (
            <Text size="sm" tone="muted">
                {drawer.managersOnlyText}
            </Text>
        )
    }
    if (drawer.adjustMode === "form") return <AdjustForm drawer={drawer} on={props.on} />
    return (
        <div className={FORM_ACTIONS_CLASS_NAME}>
            <Button variant="secondary" onPress={props.on.startAdjust}>
                {drawer.openLabel}
            </Button>
        </div>
    )
}

/** The ledger derived from invoices and payments, with a drawer showing where each line came from. */
export const AccountingLedgerBase = (props: AccountingLedgerBaseProps) => {
    const drawer = props.props.drawer
    return (
        <div className={PANEL_CLASS_NAME}>
            <AccountingBlock label={props.props.title}>
                <AccountingSectionHead
                    title={props.props.title}
                    intro={props.props.intro}
                    choiceLabel={props.props.filterLabel}
                    choices={props.props.filterItems}
                    selectedChoice={props.props.selectedFilter}
                    onChoose={props.on.selectFilter}
                />
                <AccountingRecordList
                    label={props.props.title}
                    empty={props.props.empty}
                    emptyBody={props.props.emptyBody}
                    records={props.props.records}
                    onOpen={props.on.openEntry}
                />
                <Text size="xs" tone="muted">
                    {props.props.foot}
                </Text>
            </AccountingBlock>
            <Drawer
                isOpen={drawer.isOpen}
                onOpenChange={(open) => {
                    if (!open) props.on.closeDrawer()
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
                        <AdjustSection drawer={drawer} on={props.on} />
                    </AccountingBlock>
                </div>
            </Drawer>
        </div>
    )
}
