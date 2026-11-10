import { EmptyNotice, Section, type ListRowData } from "@starci/grammar/common"
import type { CreditsOverviewView, PayTarget } from "@/modules/types"
import { nivoIconSource } from "@/components/leaves/Icon"

interface CreditsCatalogueProps {
    readonly props: {
        readonly packs: CreditsOverviewView["packs"]
        readonly canBuy: boolean
        readonly label: string
        readonly fact: string
        readonly buy: string
        readonly empty: string
        readonly isLoading: boolean
    }
    readonly on: { readonly buy: (target: PayTarget) => void }
}

/** Draws available credit packs and their resolved purchase actions. */
export const CreditsCatalogue = (props: CreditsCatalogueProps) => {
    const copy = props.props
    const rows: ReadonlyArray<ListRowData> = copy.packs.map((pack) => ({
        id: pack.id,
        title: pack.title,
        description: pack.description,
        ...(copy.canBuy
            ? {
                  action: {
                      label: copy.buy,
                      intent: "alternative",
                      isPending: pack.pending,
                      isDisabled: pack.disabled,
                      press: () => props.on.buy(pack.target),
                  },
              }
            : {}),
    }))
    return (
        <Section
            kind="list"
            title={copy.label}
            headingLevel={2}
            caption={copy.fact}
            isLoading={copy.isLoading}
            empty={<EmptyNotice message={copy.empty} iconSource={nivoIconSource("credit", "leading")} />}
            items={rows}
        />
    )
}
