import { EmptyNotice, SurfaceListCard } from "@starci/grammar/common"
import { CreditsListRow } from "@/components/branches/CreditsListRow"
import type { CreditsOverviewView } from "@/hooks/credits"
import type { PayTarget } from "@/modules/types"

interface CreditsCatalogueProps {
    readonly props: {
        readonly packs: CreditsOverviewView["packs"]
        readonly canBuy: boolean
        readonly label: string
        readonly fact: string
        readonly buy: string
        readonly empty: string
        readonly loading: string
        readonly isSkeleton: boolean
    }
    readonly on: { readonly buy: (target: PayTarget) => void }
}

/** Draws available credit packs and their resolved purchase actions. */
export const CreditsCatalogue = (props: CreditsCatalogueProps) => {
    const copy = props.props
    const packs = copy.isSkeleton
        ? Array.from({ length: 3 }, (_, index) => ({
              id: String(index),
              title: copy.loading,
              description: copy.loading,
              pending: false,
              disabled: true,
              target: { kind: "topup" as const, packCode: "", credits: 0 },
          }))
        : copy.packs
    const rows = packs.map((pack) => ({
        id: pack.id,
        props: {
            title: pack.title,
            description: pack.description,
            badge: "",
            badgeTone: "neutral" as const,
            isSkeleton: copy.isSkeleton,
            purchase:
                copy.canBuy || copy.isSkeleton
                    ? { label: copy.buy, pending: pack.pending, disabled: pack.disabled }
                    : undefined,
        },
        on: { purchase: () => props.on.buy(pack.target) },
    }))
    return (
        <SurfaceListCard
            label={copy.label}
            headingLevel={2}
            fact={copy.fact}
            isLoading={copy.isSkeleton}
            empty={<EmptyNotice message={copy.empty} />}
        >
            {rows.map((row) => (
                <CreditsListRow key={row.id} props={row.props} on={row.on} />
            ))}
        </SurfaceListCard>
    )
}
