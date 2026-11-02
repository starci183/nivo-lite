import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import type { ContractItemView } from "@/modules/types"

/** The recurring-contract collection, with read status and commands resolved by its block. */
interface SalesContractRowsProps {
    readonly label: string
    readonly empty: string
    readonly editLabel: string
    readonly rows: ReadonlyArray<ContractItemView>
    readonly isLoading: boolean
    readonly onEdit: (contractId: string) => void
}

/** Draws the same typed native rows for ready and placeholder records. */
export const SalesContractRows = (props: SalesContractRowsProps) => (
    <SurfaceCard
        kind="list"
        ariaLabel={props.label}
        isLoading={props.isLoading}
        empty={<EmptyNotice message={props.empty} />}
        items={props.rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            badges:
                row.when === null
                    ? [{ label: row.statusLabel, tone: row.statusTone, isDot: true }]
                    : [
                          { label: row.statusLabel, tone: row.statusTone, isDot: true },
                          { label: row.when.text, tone: row.when.tone },
                      ],
            action: { label: props.editLabel, intent: "neutral", press: () => props.onEdit(row.id) },
        }))}
    />
)
