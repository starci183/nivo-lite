import type { ContentViews, ContentActions } from "@/modules/types"

import { Button, Cluster, Input, Stack, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { ContentCommandNote } from "@/components/leaves/ContentCommandNote"

/** Resolved settings fields and atomic edits; the workbench owns their read and activation. */
type ContentBrandSettingsProps = ContentViews["brandFields"] & {
    readonly on: ContentActions["brandActions"]
    readonly isLoading: boolean
}

/** The existing brand settings anatomy, drawn from resolved words and the current form values. */
export const ContentBrandSettings = (props: ContentBrandSettingsProps) => {
    const { copy, canManage, isPending } = props
    const locked = !canManage || isPending
    return (
        <SurfaceCard label={copy.settingsBrand} headingLevel={2} isLoading={props.isLoading}>
            <Stack gap="row">
                <Text size="sm" tone="muted">
                    {copy.settingsBrandBody}
                </Text>
                <Textarea
                    isLoading={props.isLoading}
                    label={copy.brandVoice}
                    rows={3}
                    value={props.voice}
                    isDisabled={locked}
                    onValueChange={props.on.voice}
                />
                <Textarea
                    isLoading={props.isLoading}
                    label={copy.brandAvoid}
                    rows={3}
                    value={props.avoid}
                    isDisabled={locked}
                    onValueChange={props.on.avoid}
                />
                <Input
                    isLoading={props.isLoading}
                    id="brand-cta"
                    name="brand-cta"
                    label={copy.brandCta}
                    value={props.cta}
                    isDisabled={locked}
                    onValueChange={props.on.cta}
                />
                <Input
                    isLoading={props.isLoading}
                    id="brand-tags"
                    name="brand-tags"
                    label={copy.brandHashtags}
                    value={props.tags}
                    description={copy.fieldHashtagsHint}
                    isDisabled={locked}
                    onValueChange={props.on.tags}
                />
                <ContentCommandNote note={props.note} closeLabel={copy.close} onDismiss={props.on.dismissNote} />
                <Cluster gap="inline">
                    <Button
                        isLoading={props.isLoading}
                        intent="commit"
                        size="sm"
                        isPending={isPending}
                        isDisabled={!canManage}
                        onPress={props.on.save}
                    >
                        {copy.brandSave}
                    </Button>
                </Cluster>
            </Stack>
        </SurfaceCard>
    )
}
