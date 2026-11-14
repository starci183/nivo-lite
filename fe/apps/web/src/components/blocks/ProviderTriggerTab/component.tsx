import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Stack, Text } from "@starci/grammar/common"
import { PROVIDER_DOC_PLACEHOLDER, ProviderDocList } from "@/components/composites/ProviderDocList"
import type { ProviderDocLevelView, ProviderDocWords, SlotLabels } from "@/modules/types"
import { ProviderTriggerCardBase, type ProviderTriggerCardBaseProps } from "./triggerCard"

/** The words and the reads of the Trigger tab of a connected account's page. */
export interface ProviderTriggerTabBaseProps {
    readonly props: {
        readonly level: ProviderDocLevelView
        readonly words: ProviderDocWords
        readonly slotLabels: SlotLabels
        readonly card: ProviderTriggerCardBaseProps
    }
    readonly on: { readonly retry: () => void }
}

/**
 * The Trigger tab of the provider page template: the level's lead line on the page ground, the Trigger section (each trigger's
 * switch, last fire and the workflows it wakes), then one documentation card per trigger from the registry. A provider with no
 * trigger keeps the section label and says so under it; the documentation collapses, so the line is not said twice.
 */
export const ProviderTriggerTabBase = (props: ProviderTriggerTabBaseProps) => (
    <Stack gap="section">
        <Text size="xs" tone="muted">
            {props.props.level.lead}
        </Text>
        <ProviderTriggerCardBase {...props.props.card} />
        <SlotView
            slot={props.props.level.entries}
            placeholder={PROVIDER_DOC_PLACEHOLDER}
            labels={props.props.slotLabels}
            empty="collapse"
            onRetry={props.on.retry}
            render={(entries, isLoading) => (
                <ProviderDocList entries={entries} words={props.props.words} isLoading={isLoading} />
            )}
        />
    </Stack>
)
