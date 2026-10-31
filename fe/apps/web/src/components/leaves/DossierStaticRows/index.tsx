import { StaticStateRow, SurfaceListCard } from "@starci/grammar/common"
import type { EvidenceItemView } from "@/hooks/brain"

/** What the static list says. */
interface DossierStaticRowsProps {
    readonly label: string
    readonly items: ReadonlyArray<EvidenceItemView>
}

/** A list of lines that only inform, in one card: the evidence of a finding, or the places a draft leaves to fill. */
export const DossierStaticRows = (props: DossierStaticRowsProps) => (
    <SurfaceListCard ariaLabel={props.label}>
        {props.items.map((item) => (
            <StaticStateRow key={item.id} item={item} />
        ))}
    </SurfaceListCard>
)

export type { EvidenceItemView } from "@/hooks/brain"
