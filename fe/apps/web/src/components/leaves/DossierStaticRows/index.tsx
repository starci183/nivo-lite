import { EmptyNotice, Section } from "@starci/grammar/common"
import type { EvidenceItemView } from "@/hooks/brain"

/** What the static list says. */
interface DossierStaticRowsProps {
    readonly label: string
    readonly items: ReadonlyArray<EvidenceItemView>
    readonly isLoading?: boolean
}

/** Informative rows share their drawer or finding's existing surface. */
export const DossierStaticRows = (props: DossierStaticRowsProps) => (
    <Section
        kind="list"
        title={props.label}
        headingLevel={4}
        isLoading={props.isLoading === true}
        empty={<EmptyNotice message={props.label} />}
        items={props.items.map((item) => ({
            id: item.id,
            title: item.label,
            ...(item.description === undefined ? {} : { description: item.description }),
        }))}
    />
)

export type { EvidenceItemView } from "@/hooks/brain"
