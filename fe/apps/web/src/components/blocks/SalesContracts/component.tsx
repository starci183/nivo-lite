import { Badge, Button, EmptyNotice, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SalesContractDrawer } from "@/components/composites/SalesContractDrawer"
import type { SalesContractDrawerProps } from "@/components/composites/SalesContractDrawer"
import { ACTIONS_CLASS_NAME } from "./classNames"

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
        readonly editLabel: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly note: string
        readonly rows: ReadonlyArray<ContractItemView>
        /** The contract drawer while it is open. */
        readonly drawer: SalesContractDrawerProps["props"] | null
    }
    readonly on: SalesContractDrawerProps["on"] & {
        readonly add: () => void
        readonly edit: (contractId: string) => void
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
            <div className={ACTIONS_CLASS_NAME}>
                <Button variant="primary" size="sm" onPress={on.add}>
                    {p.addLabel}
                </Button>
            </div>
            <Text size="sm" weight="medium" live="polite">
                {p.note}
            </Text>
            <SurfaceListCard
                ariaLabel={p.label}
                empty={<EmptyNotice message={p.emptyTitle} description={p.emptyBody} />}
            >
                {p.rows.map((row) => (
                    <ListRow
                        key={row.id}
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
                            <Button variant="outline" size="sm" onPress={() => on.edit(row.id)}>
                                {p.editLabel}
                            </Button>
                        }
                    />
                ))}
            </SurfaceListCard>
            {p.drawer === null ? null : <SalesContractDrawer props={p.drawer} on={on} />}
        </>
    )
}
