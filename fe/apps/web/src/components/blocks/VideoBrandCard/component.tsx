import { Alert, Button, FileDropzone, Image, Input, Select, SurfaceCard, Text } from "@starci/grammar/common"
import { BRAND_ACTIONS, BRAND_LOGO, BRAND_LOGO_PREVIEW, BRAND_ROW, BRAND_STACK } from "./classNames"

/** One choice of a select. */
export interface VideoBrandOption {
    readonly id: string
    readonly label: string
}

/** Copy, state and handlers of the brand kit card. */
export interface VideoBrandCardBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly shopNameLabel: string
        readonly shopName: string
        readonly primaryLabel: string
        readonly primary: string
        readonly secondaryLabel: string
        readonly secondary: string
        readonly colorHint: string
        readonly logoLabel: string
        readonly logoUrl: string | null
        readonly logoNone: string
        readonly logoUpload: string
        readonly logoRemove: string
        readonly hasLogo: boolean
        readonly musicLabel: string
        readonly music: string
        readonly musics: ReadonlyArray<VideoBrandOption>
        readonly voiceLabel: string
        readonly voice: string
        readonly voices: ReadonlyArray<VideoBrandOption>
        readonly saveLabel: string
        readonly canEdit: boolean
        readonly pending: boolean
        readonly message: { readonly tone: "affirmative" | "negative"; readonly text: string } | null
    }
    readonly on: {
        readonly shopName: (value: string) => void
        readonly primary: (value: string) => void
        readonly secondary: (value: string) => void
        readonly logoFiles: (files: ReadonlyArray<File>) => void
        readonly logoRemove: () => void
        readonly music: (value: string | null) => void
        readonly voice: (value: string | null) => void
        readonly save: () => void
    }
}

const logoOf = (props: VideoBrandCardBaseProps) => {
    return (
        <div className={BRAND_STACK}>
            <Text as="span" size="sm" weight="medium">
                {props.props.logoLabel}
            </Text>
            <div className={BRAND_LOGO}>
                {props.props.logoUrl === null ? (
                    <Text as="span" size="xs" tone="muted">
                        {props.props.logoNone}
                    </Text>
                ) : (
                    <div className={BRAND_LOGO_PREVIEW}>
                        <Image src={props.props.logoUrl} alt={props.props.logoLabel} aspect="square" fit="contain" />
                    </div>
                )}
                {props.props.canEdit ? (
                    <FileDropzone
                        label={props.props.logoUpload}
                        isLabelHidden
                        accept="image/png,image/jpeg,image/webp"
                        hideFileList
                        isDisabled={props.props.pending}
                        prompt={props.props.logoUpload}
                        onFilesChange={props.on.logoFiles}
                    />
                ) : null}
                {props.props.canEdit && props.props.hasLogo ? (
                    <Button
                        size="sm"
                        intent="destructive"
                        step="entry"
                        isDisabled={props.props.pending}
                        onPress={props.on.logoRemove}
                    >
                        {props.props.logoRemove}
                    </Button>
                ) : null}
            </div>
        </div>
    )
}

/** Draws the brand kit: shop name, two colours, logo, background music and voice. */
export const VideoBrandCardBase = (props: VideoBrandCardBaseProps) => {
    const off = !props.props.canEdit || props.props.pending
    return (
        <SurfaceCard label={props.props.title} fact={props.props.hint}>
            <div className={BRAND_STACK}>
                <Input
                    id="video-shop-name"
                    name="shopName"
                    label={props.props.shopNameLabel}
                    value={props.props.shopName}
                    isDisabled={off}
                    onValueChange={props.on.shopName}
                />
                <div className={BRAND_ROW}>
                    <Input
                        id="video-primary"
                        name="primary"
                        label={props.props.primaryLabel}
                        description={props.props.colorHint}
                        value={props.props.primary}
                        isDisabled={off}
                        onValueChange={props.on.primary}
                    />
                    <Input
                        id="video-secondary"
                        name="secondary"
                        label={props.props.secondaryLabel}
                        description={props.props.colorHint}
                        value={props.props.secondary}
                        isDisabled={off}
                        onValueChange={props.on.secondary}
                    />
                </div>
                {logoOf(props)}
                <div className={BRAND_ROW}>
                    <Select
                        label={props.props.musicLabel}
                        value={props.props.music}
                        isDisabled={off}
                        options={props.props.musics}
                        onValueChange={props.on.music}
                    />
                    <Select
                        label={props.props.voiceLabel}
                        value={props.props.voice}
                        isDisabled={off}
                        options={props.props.voices}
                        onValueChange={props.on.voice}
                    />
                </div>
                {props.props.message === null ? null : (
                    <Alert tone={props.props.message.tone} title={props.props.message.text} />
                )}
                {props.props.canEdit ? (
                    <div className={BRAND_ACTIONS}>
                        <Button intent="commit" isPending={props.props.pending} onPress={props.on.save}>
                            {props.props.saveLabel}
                        </Button>
                    </div>
                ) : null}
            </div>
        </SurfaceCard>
    )
}
