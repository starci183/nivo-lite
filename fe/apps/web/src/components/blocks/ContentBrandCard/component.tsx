import { Button, Cluster, Input, Stack, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { ContentCommandNote } from "@/components/composites/ContentSettingsCard"
import type { ContentNoteView, ContentT } from "@/modules/types"

/** What the brand voice card draws. */
export interface ContentBrandCardBaseProps {
    readonly props: {
        readonly t: ContentT
        readonly voice: string
        readonly avoid: string
        readonly cta: string
        readonly tags: string
        readonly canManage: boolean
        readonly isPending: boolean
        readonly note: ContentNoteView | null
    }
    readonly on: {
        readonly voice: (v: string) => void
        readonly avoid: (v: string) => void
        readonly cta: (v: string) => void
        readonly tags: (v: string) => void
        readonly save: () => void
        readonly dismissNote: () => void
    }
}

/** Draws the brand voice: how posts should sound, what never to say, the usual call to action and the brand hashtags. */
export const ContentBrandCardBase = (props: ContentBrandCardBaseProps) => {
    const { t, canManage, isPending } = props.props
    const locked = !canManage || isPending
    return (
        <SurfaceCard label={t("settingsBrand")} headingLevel={2}>
            <Stack gap="row">
                <Text size="sm" tone="muted">
                    {t("settingsBrandBody")}
                </Text>
                <Textarea
                    label={t("brandVoice")}
                    rows={3}
                    value={props.props.voice}
                    isDisabled={locked}
                    onValueChange={props.on.voice}
                />
                <Textarea
                    label={t("brandAvoid")}
                    rows={3}
                    value={props.props.avoid}
                    isDisabled={locked}
                    onValueChange={props.on.avoid}
                />
                <Input
                    id="brand-cta"
                    name="brand-cta"
                    label={t("brandCta")}
                    value={props.props.cta}
                    isDisabled={locked}
                    onValueChange={props.on.cta}
                />
                <Input
                    id="brand-tags"
                    name="brand-tags"
                    label={t("brandHashtags")}
                    value={props.props.tags}
                    description={t("fieldHashtagsHint")}
                    isDisabled={locked}
                    onValueChange={props.on.tags}
                />
                <ContentCommandNote note={props.props.note} closeLabel={t("close")} onDismiss={props.on.dismissNote} />
                <Cluster gap="inline">
                    <Button
                        intent="commit"
                        size="sm"
                        isPending={isPending}
                        isDisabled={!canManage}
                        onPress={props.on.save}
                    >
                        {t("brandSave")}
                    </Button>
                </Cluster>
            </Stack>
        </SurfaceCard>
    )
}
