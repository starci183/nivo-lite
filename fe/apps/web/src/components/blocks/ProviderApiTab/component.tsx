import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Stack, Text } from "@starci/grammar/common"
import { PROVIDER_DOC_PLACEHOLDER, ProviderDocList } from "@/components/composites/ProviderDocList"
import type { ProviderDocLevelView, ProviderDocWords, SlotLabels } from "@/modules/types"

/** The words and the read of the Api tab of a connected account's page. */
export interface ProviderApiTabBaseProps {
    readonly props: {
        readonly level: ProviderDocLevelView
        readonly words: ProviderDocWords
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/**
 * The Api tab of the provider page template: the level's lead line on the page ground, then one card per documented entry
 * (the reads a screen calls (level 1)), from the registry; a level the provider lacks says so in one line.
 */
export const ProviderApiTabBase = (props: ProviderApiTabBaseProps) => (
    <Stack gap="section">
        <Text size="xs" tone="muted">
            {props.props.level.lead}
        </Text>
        <SlotView
            slot={props.props.level.entries}
            placeholder={PROVIDER_DOC_PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
            render={(entries, isLoading) => (
                <ProviderDocList entries={entries} words={props.props.words} isLoading={isLoading} />
            )}
        />
    </Stack>
)
