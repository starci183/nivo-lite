import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { FileRef } from "@nivo-lite/agent-sdk/entity"
import { EmptyNotice, Grid, Image, Link, MediaFrame, Skeleton, Stack, Text, Video } from "@starci/grammar/common"
import type { filePreviewBlock } from "../../blocks/file-preview.block"
import { bytesText, fileItemsOf, fileKindOf, fileLimitsOf, fileRefOf, type FileKind, type FileLimits } from "../../rows/file-field"
import { recordIdOf } from "../../rows/form-values"
import { valueAt } from "../../slots/paths"
import { SurfaceFrame } from "../composites/SurfaceFrame"
import { useBlockFiles } from "../composites/useBlockFiles"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import { useSignedFileUrl, type SignedFileAddress } from "../composites/useSignedFileUrl"
import type { RenderOf } from "../render-props"

/** The id the block names itself by when it reports a defect. */
const BLOCK_ID = "core.file-preview"

/** What the link of a file is given: the file, its address and the words and language around it. */
interface FileLinkProps {
    readonly file: FileRef
    readonly address: SignedFileAddress
    /** The viewer's language, for the size. */
    readonly locale: string
    /** What an external link announces: that it opens in a new tab. */
    readonly opensWords: string
}

/** A file that has no picture or player, audio included: its name as the link that opens it, over its size and type. */
const FileLink = (props: FileLinkProps): ReactNode => (
    <Stack gap="inline">
        <Link
            href={props.address.url ?? ""}
            variant="plain"
            kind="external"
            externalHint={props.opensWords}
            isDisabled={props.address.url === null}
        >
            {props.file.name}
        </Link>
        <Text size="xs" tone="muted">
            {`${bytesText(props.file.size, props.locale)} \u00b7 ${props.file.mime}`}
        </Text>
    </Stack>
)

/** What a picture is given: the file and its address. */
interface ImageViewProps {
    readonly file: FileRef
    readonly address: SignedFileAddress
}

/** An image at its own ratio, or the geometry of one while its address is asked. */
const ImageView = (props: ImageViewProps): ReactNode =>
    props.address.url === null ? (
        <Skeleton shape="rect" ratio="wide" />
    ) : (
        <MediaFrame
            aspect="auto"
            fit="contain"
            media={<Image src={props.address.url} alt={props.file.name} aspect="auto" fit="contain" />}
        />
    )

/** What a player is given: the file, its address and the address of its poster, when it has one. */
interface VideoViewProps {
    readonly file: FileRef
    readonly address: SignedFileAddress
    /** The poster's address; null when the record holds no poster. */
    readonly poster: SignedFileAddress | null
}

/** A video in a player, with its poster picture when the spec names a poster field and the record holds one. */
const VideoView = (props: VideoViewProps): ReactNode =>
    props.address.url === null ? (
        <Skeleton shape="rect" ratio="wide" />
    ) : (
        <MediaFrame
            aspect="auto"
            fit="contain"
            media={
                <Video
                    src={props.address.url}
                    title={props.file.name}
                    {...(props.poster?.url == null ? {} : { poster: props.poster.url })}
                />
            }
        />
    )

/** What the shown file is given: the file, both addresses and the words around it. */
interface FileShownProps extends FileLinkProps {
    readonly kind: FileKind
    /** The poster's address; null when the record holds no poster. */
    readonly poster: SignedFileAddress | null
    /** What a refused address says. */
    readonly failedWords: string
}

/** The file as its kind asks: a picture, a player, or a link that opens it; a line saying so when the host refused its address. */
const FileShown = (props: FileShownProps): ReactNode => {
    const { file, address, poster } = props
    if (address.isFailed) return <Text tone="muted">{props.failedWords}</Text>
    if (props.kind === "image") return <ImageView file={file} address={address} />
    if (props.kind === "video") return <VideoView file={file} address={address} poster={poster} />
    return <FileLink file={file} address={address} locale={props.locale} opensWords={props.opensWords} />
}

/** What one file of a list field is given: the record it is on, the file, and the words and language around it. */
interface ListItemProps {
    readonly block: RenderOf<typeof filePreviewBlock>
    readonly id: string
    readonly file: FileRef
    readonly files: ReturnType<typeof useBlockFiles>
    readonly locale: string
    readonly opensWords: string
    readonly failedWords: string
}

/** One file of a list field as its kind asks, with an address of its own (asked by the file's key). */
const ListItem = (props: ListItemProps): ReactNode => {
    const spec = props.block.props
    const address = useSignedFileUrl(props.files, {
        type: spec.type,
        id: props.id,
        field: spec.field,
        version: props.file.key,
        item: props.file.key,
    })
    return (
        <FileShown
            file={props.file}
            kind={fileKindOf(props.file.mime)}
            address={address}
            poster={null}
            locale={props.locale}
            opensWords={props.opensWords}
            failedWords={props.failedWords}
        />
    )
}

/** What the files of a list field are given. */
interface ListShownProps extends Omit<ListItemProps, "file"> {
    readonly items: ReadonlyArray<FileRef>
}

/** The files of a list field in order: the pictures as a small gallery, then every other file as it asks (a player, a link). */
const ListShown = (props: ListShownProps): ReactNode => {
    const pictures = props.items.filter((file) => fileKindOf(file.mime) === "image")
    const others = props.items.filter((file) => fileKindOf(file.mime) !== "image")
    return (
        <Stack gap="row">
            {pictures.length === 0 ? null : (
                <Grid kind="cards" gap="inline" columns="balanced">
                    {pictures.map((file) => (
                        <ListItem key={file.key} {...props} file={file} />
                    ))}
                </Grid>
            )}
            {others.map((file) => (
                <ListItem key={file.key} {...props} file={file} />
            ))}
        </Stack>
    )
}

/** What the filled preview is given. */
interface PreviewBodyProps {
    readonly block: RenderOf<typeof filePreviewBlock>
    readonly record: unknown
    readonly isLoading: boolean
    /** What the field declares; its maximum is set for a list field. */
    readonly limits: FileLimits
}

/** The file on the field, or the empty notice when the record holds none. */
const PreviewBody = (props: PreviewBodyProps): ReactNode => {
    const { block } = props
    const spec = block.props
    const host = useBlockHost()
    const words = useBlockWords()
    const files = useBlockFiles(BLOCK_ID)
    const id = recordIdOf(props.record, spec.idPath ?? "id")
    const items = fileItemsOf(props.limits, valueAt(props.record, spec.field))
    const file = items[0] ?? null
    const poster = spec.posterField === undefined ? null : fileRefOf(valueAt(props.record, spec.posterField))
    const address = useSignedFileUrl(
        files,
        file === null ? null : { type: spec.type, id, field: spec.field, version: file.key },
    )
    const posterAddress = useSignedFileUrl(
        files,
        poster === null || spec.posterField === undefined
            ? null
            : { type: spec.type, id, field: spec.posterField, version: poster.key },
    )
    if (props.limits.max !== null) {
        return (
            <SurfaceFrame surface={spec.surface} label={words(spec.label)} isLoading={props.isLoading}>
                {items.length === 0 ? (
                    <EmptyNotice message={words(spec.empty ?? { key: "filePreviewEmpty" })} />
                ) : (
                    <ListShown
                        block={block}
                        id={id}
                        items={items}
                        files={files}
                        locale={host.locale()}
                        opensWords={words({ key: "filePreviewOpens" })}
                        failedWords={words({ key: "filePreviewFailed" })}
                    />
                )}
            </SurfaceFrame>
        )
    }
    return (
        <SurfaceFrame surface={spec.surface} label={words(spec.label)} isLoading={props.isLoading}>
            <Stack gap="row">
                {file === null ? (
                    <EmptyNotice message={words(spec.empty ?? { key: "filePreviewEmpty" })} />
                ) : (
                    <FileShown
                        file={file}
                        kind={fileKindOf(file.mime)}
                        address={address}
                        poster={poster === null ? null : posterAddress}
                        locale={host.locale()}
                        opensWords={words({ key: "filePreviewOpens" })}
                        failedWords={words({ key: "filePreviewFailed" })}
                    />
                )}
            </Stack>
        </SurfaceFrame>
    )
}

/**
 * Shows the file on the declared file field of the bound record as its content type asks (a list field shows all its files in order:
 * the pictures as a small gallery, every other file as it asks): an image as a picture, a video in a
 * player (its poster from the spec's poster field), anything else, audio included, as a link that opens it with the file's name,
 * size and type. The bytes come through a short-lived signed address the host's file port issues; the block asks again before it
 * expires and draws the geometry of the media while the address is asked. A record with no file on the field says so.
 */
export const FilePreviewBlock = (props: RenderOf<typeof filePreviewBlock>): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.empty ?? { key: "filePreviewEmpty" })
    const read = props.slots.record
    const limits = fileLimitsOf(props.props.type, props.props.field)
    if (limits === null) return null
    return (
        <SlotView
            slot={read.slot}
            labels={labels}
            placeholder={{}}
            onRetry={read.retry}
            frame={(notice) => (
                <SurfaceFrame surface={props.props.surface} label={words(props.props.label)}>
                    {notice}
                </SurfaceFrame>
            )}
            render={(record, isLoading) => (
                <PreviewBody block={props} record={record} isLoading={isLoading} limits={limits} />
            )}
        />
    )
}
