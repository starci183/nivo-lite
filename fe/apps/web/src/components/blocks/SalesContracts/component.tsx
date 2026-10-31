import { Badge, Button, Cluster, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SalesContractDrawer } from "@/components/composites/SalesContractDrawer"
import type { SalesContractDrawerProps } from "@/components/composites/SalesContractDrawer"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { ContractImportDialog } from "@/components/composites/ContractImportDialog"
import type { ContractImportDialogProps } from "@/components/composites/ContractImportDialog"

/** One recurring contract, every word already resolved. */
export interface ContractItemView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly when: { readonly text: string; readonly tone: BadgeTone } | null
}

/** The words and data of the contracts surface. */
export interface SalesContractsBaseProps {
    readonly props: {
        readonly label: string
        readonly intro: string
        readonly addLabel: string
        readonly importLabel: string
        readonly editLabel: string
        readonly note: string
        /** The contracts of the workbench, one slot: loading, failed, empty or the rows. */
        readonly rows: DataSlot<ReadonlyArray<ContractItemView>>
        /** One blank row: the skeleton draws the same list as the ready one. */
        readonly rowsPlaceholder: ReadonlyArray<ContractItemView>
        readonly rowsLabels: SlotLabels
        /** The contract drawer while it is open. */
        readonly drawer: SalesContractDrawerProps["props"] | null
        /** The bulk import dialog while it is open. */
        readonly importDialog: ContractImportDialogProps["props"] | null
    }
    readonly on: SalesContractDrawerProps["on"] & {
        readonly retry: () => void
        readonly add: () => void
        readonly edit: (contractId: string) => void
        readonly openImport: () => void
        readonly importSource: (value: string) => void
        readonly importFile: (files: Array<File>) => void
        readonly importPaste: (value: string) => void
        readonly importPreview: () => void
        readonly importSheet: (value: string | null) => void
        readonly importColumn: (field: string, column: string | null) => void
        readonly importConfirm: () => void
        readonly importClose: () => void
    }
}

/** Surface 5: recurring contracts. The renewal automation reminds the customer (and sales) a number of days before the end date. */
export const SalesContractsBase = (props: SalesContractsBaseProps) => {
    const { props: p, on } = props
    return (
        <>
            <Text size="sm" tone="muted">
                {p.intro}
            </Text>
            <Cluster gap="inline">
                <Button intent="commit" size="sm" onPress={on.add}>
                    {p.addLabel}
                </Button>
                <Button intent="neutral" size="sm" onPress={on.openImport}>
                    {p.importLabel}
                </Button>
            </Cluster>
            <Text size="sm" weight="medium" live="polite">
                {p.note}
            </Text>
            <SlotView slot={p.rows} placeholder={p.rowsPlaceholder} labels={p.rowsLabels} onRetry={on.retry}>
                {(rows, isSkeleton) => (
                    <SurfaceListCard ariaLabel={p.label}>
                        {rows.map((row) => (
                            <ListRow
                                key={row.id}
                                isSkeleton={isSkeleton}
                                title={row.title}
                                description={row.description}
                                badges={
                                    <>
                                        <Badge tone={row.statusTone} isDot>
                                            {row.statusLabel}
                                        </Badge>
                                        {row.when === null ? null : <Badge tone={row.when.tone}>{row.when.text}</Badge>}
                                    </>
                                }
                                actions={
                                    <Button
                                        intent="neutral"
                                        size="sm"
                                        isSkeleton={isSkeleton}
                                        onPress={() => on.edit(row.id)}
                                    >
                                        {p.editLabel}
                                    </Button>
                                }
                            />
                        ))}
                    </SurfaceListCard>
                )}
            </SlotView>
            {p.drawer === null ? null : <SalesContractDrawer props={p.drawer} on={on} />}
            {p.importDialog === null ? null : (
                <ContractImportDialog
                    props={p.importDialog}
                    on={{
                        source: on.importSource,
                        file: on.importFile,
                        paste: on.importPaste,
                        preview: on.importPreview,
                        sheet: on.importSheet,
                        column: on.importColumn,
                        confirm: on.importConfirm,
                        close: on.importClose,
                    }}
                />
            )}
        </>
    )
}
