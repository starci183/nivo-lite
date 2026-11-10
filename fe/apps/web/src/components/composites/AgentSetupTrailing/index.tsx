import { Text } from "@starci/grammar/common"
import { BrandProposalView, type BrandProposalCommands } from "@/components/leaves/BrandProposalView"
import type { BrandProposalCardView } from "@/hooks/content"
import type { AgentSetupChatContent } from "@/modules/types"

/** The brand kits read from the guideline PDF of the AI Marketing agent, and the line shown while one is being read. */
export interface AgentSetupBrandKits {
    readonly isReading: boolean
    readonly readingLabel: string
    readonly cards: ReadonlyArray<BrandProposalCardView>
}

/** The commands of the brand kits. */
interface AgentSetupTrailingCommands {
    readonly brandField: BrandProposalCommands["field"]
    readonly brandConfirm: (id: string) => void
    readonly brandToggleEdit: (id: string) => void
    readonly brandReject: (id: string) => void
}

/** The chat content, the brand kits (none for the other agents) and the commands of the kits. */
interface AgentSetupTrailingProps {
    readonly content: AgentSetupChatContent
    readonly brand: AgentSetupBrandKits | null
    readonly on: AgentSetupTrailingCommands
}

/** What stands after the last message of the setup chat: the brand kits, a turn that was lost, and the sending or reading line. */
export const AgentSetupTrailing = (props: AgentSetupTrailingProps) => {
    const { content, brand, on } = props
    const reading = brand?.isReading === true ? brand.readingLabel : ""
    const brandOn: BrandProposalCommands = {
        field: on.brandField,
        confirm: on.brandConfirm,
        toggleEdit: on.brandToggleEdit,
        reject: on.brandReject,
    }
    return (
        <>
            {brand?.cards.map((card) => (
                <BrandProposalView key={card.id} props={card} on={brandOn} />
            ))}
            {content.staleLabel === "" ? null : (
                <Text size="sm" tone="muted" live="polite">
                    {content.staleLabel}
                </Text>
            )}
            {content.isSending || reading !== "" ? (
                <Text size="sm" tone="muted" live="polite">
                    {reading === "" ? content.sendingLabel : reading}
                </Text>
            ) : null}
        </>
    )
}
