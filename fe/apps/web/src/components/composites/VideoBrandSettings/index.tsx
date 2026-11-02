import type { VideoLibraryActions, VideoLibraryViews } from "@/modules/types"
type VideoBrandSettingsFields = VideoLibraryViews["brand"]
type VideoBrandSettingsActions = VideoLibraryActions["brand"]

interface VideoBrandSettingsProps extends VideoBrandSettingsFields {
    readonly isLoading: boolean
    readonly on: VideoBrandSettingsActions
}
import {
    Heading,
    Stack,
    Cluster,
    Grid,
    Alert,
    Button,
    FileDropzone,
    Image,
    Input,
    Select,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"

import { BRAND_LOGO_PREVIEW } from "./classNames"

const logoOf = (props: VideoBrandSettingsProps) => {
    return (
        <Stack gap="section">
            <Heading level={3}>{props.logoLabel}</Heading>
            <Cluster gap="inline">
                {props.logoUrl === null ? (
                    <Text isLoading={props.isLoading} as="span" size="xs" tone="muted">
                        {props.logoNone}
                    </Text>
                ) : (
                    <div className={BRAND_LOGO_PREVIEW}>
                        <Image src={props.logoUrl} alt={props.logoLabel} aspect="square" fit="contain" />
                    </div>
                )}
                {props.canEdit ? (
                    <FileDropzone
                        label={props.logoUpload}
                        isLabelHidden
                        accept="image/png,image/jpeg,image/webp"
                        hideFileList
                        isDisabled={props.pending}
                        prompt={props.logoUpload}
                        onFilesChange={props.on.logoFiles}
                    />
                ) : null}
                {props.canEdit && props.hasLogo ? (
                    <Button
                        isLoading={props.isLoading}
                        size="sm"
                        intent="destructive"
                        step="entry"
                        isDisabled={props.pending}
                        onPress={props.on.logoRemove}
                    >
                        {props.logoRemove}
                    </Button>
                ) : null}
            </Cluster>
        </Stack>
    )
}

/** Draws the brand kit: shop name, two colours, logo, background music and voice. */
export const VideoBrandSettings = (props: VideoBrandSettingsProps) => {
    const off = !props.canEdit || props.pending
    return (
        <SurfaceCard isLoading={props.isLoading} label={props.title} fact={props.hint}>
            <Stack gap="section">
                <Input
                    isLoading={props.isLoading}
                    id="video-shop-name"
                    name="shopName"
                    label={props.shopNameLabel}
                    value={props.shopName}
                    isDisabled={off}
                    onValueChange={props.on.shopName}
                />
                <Grid kind="form" columns={2}>
                    <Input
                        isLoading={props.isLoading}
                        id="video-primary"
                        name="primary"
                        label={props.primaryLabel}
                        description={props.colorHint}
                        value={props.primary}
                        isDisabled={off}
                        onValueChange={props.on.primary}
                    />
                    <Input
                        isLoading={props.isLoading}
                        id="video-secondary"
                        name="secondary"
                        label={props.secondaryLabel}
                        description={props.colorHint}
                        value={props.secondary}
                        isDisabled={off}
                        onValueChange={props.on.secondary}
                    />
                </Grid>
                {logoOf(props)}
                <Grid kind="form" columns={2}>
                    <Select
                        isLoading={props.isLoading}
                        label={props.musicLabel}
                        value={props.music}
                        isDisabled={off}
                        options={props.musics}
                        onValueChange={props.on.music}
                    />
                    <Select
                        isLoading={props.isLoading}
                        label={props.voiceLabel}
                        value={props.voice}
                        isDisabled={off}
                        options={props.voices}
                        onValueChange={props.on.voice}
                    />
                </Grid>
                {props.message === null ? null : <Alert tone={props.message.tone} title={props.message.text} />}
                {props.canEdit ? (
                    <Cluster gap="inline">
                        <Button
                            isLoading={props.isLoading}
                            intent="commit"
                            isPending={props.pending}
                            onPress={props.on.save}
                        >
                            {props.saveLabel}
                        </Button>
                    </Cluster>
                ) : null}
            </Stack>
        </SurfaceCard>
    )
}
