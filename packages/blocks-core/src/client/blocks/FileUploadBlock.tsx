import { useState, type ReactNode } from "react"
import type { BlockFiles } from "@nivo-lite/agent-sdk/block"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import { AlertDialog, Button, Cluster, EmptyNotice, FileButton, FileDropzone, Progress, Section, Stack, Text } from "@starci/grammar/common"
import type { FileRef } from "@nivo-lite/agent-sdk/entity"
import type { fileUploadBlock } from "../../blocks/file-upload.block"
import { acceptWordsOf, bytesText, fileItemsOf, fileLimitsOf, roomOf, type FileLimits } from "../../rows/file-field"
import { recordIdOf } from "../../rows/form-values"
import { valueAt } from "../../slots/paths"
import { SurfaceFrame } from "../composites/SurfaceFrame"
import { useBlockFiles } from "../composites/useBlockFiles"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import { useFileUpload, type FileUploadView } from "../composites/useFileUpload"
import type { RenderOf } from "../render-props"

/** The id the block names itself by when it reports a defect. */
const BLOCK_ID = "core.file-upload"

/** What the file now on the field is given: its reference, the viewer's language and whether it still loads. */
interface CurrentFileProps {
    readonly file: FileRef
    readonly locale: string
    readonly isLoading: boolean
}

/** The name of the file on the field over its size and type. */
const CurrentFile = (props: CurrentFileProps): ReactNode => (
    <Stack gap="inline">
        <Text isStrong isLoading={props.isLoading}>
            {props.file.name}
        </Text>
        <Text size="xs" tone="muted" isLoading={props.isLoading}>
            {`${bytesText(props.file.size, props.locale)} \u00b7 ${props.file.mime}`}
        </Text>
    </Stack>
)

/** What the replace and remove controls of a file are given. */
interface FileControlsProps {
    readonly accept: string
    readonly hint: string
    readonly problem: string | undefined
    readonly isDisabled: boolean
    readonly isLoading: boolean
    readonly words: (text: SpecText) => string
    readonly onPick: (files: Array<File>) => void
    readonly onRemove: () => Promise<void>
}

/** Replaces the file, or removes it after the person confirms: the file is deleted from the store and cannot be restored. */
const FileControls = (props: FileControlsProps): ReactNode => {
    const [isConfirming, setIsConfirming] = useState(false)
    const { words } = props
    return (
        <>
            <Cluster gap="inline" justify="start" align="start">
                <FileButton
                    text={words({ key: "fileUploadReplace" })}
                    label={words({ key: "fileUploadReplaceLabel" })}
                    accept={props.accept}
                    description={props.hint}
                    {...(props.problem === undefined ? {} : { errorMessage: props.problem })}
                    isDisabled={props.isDisabled}
                    isLoading={props.isLoading}
                    onFilesChange={props.onPick}
                />
                <Button
                    intent="destructive"
                    step="entry"
                    size="sm"
                    isDisabled={props.isDisabled}
                    isLoading={props.isLoading}
                    onPress={() => setIsConfirming(true)}
                >
                    {words({ key: "fileUploadRemove" })}
                </Button>
            </Cluster>
            <AlertDialog
                isOpen={isConfirming}
                onOpenChange={setIsConfirming}
                title={words({ key: "fileUploadRemoveTitle" })}
                description={words({ key: "fileUploadRemoveBody" })}
                confirmLabel={words({ key: "fileUploadRemove" })}
                cancelLabel={words({ key: "fileUploadCancel" })}
                onConfirm={props.onRemove}
            />
        </>
    )
}

/** What the files of a list field are given: them in order, the field's limits, and what removes one. */
interface FileItemsProps {
    readonly items: ReadonlyArray<FileRef>
    readonly max: number
    readonly label: string
    readonly locale: string
    readonly isDisabled: boolean
    readonly isLoading: boolean
    readonly words: (text: SpecText) => string
    readonly onRemove: (key: string) => Promise<void>
}

/**
 * The files of a list field in their order, each with its own remove control that confirms first (the file is deleted from the store
 * and cannot be restored), over how many of the most the field holds. There is no drag to reorder: the order is the order they were added.
 */
const FileItems = (props: FileItemsProps): ReactNode => {
    const [removing, setRemoving] = useState<string | null>(null)
    const { words } = props
    return (
        <>
            <Section
                kind="list"
                ariaLabel={props.label}
                isLoading={props.isLoading}
                items={props.items.map((file, position) => ({
                    id: file.key,
                    title: file.name,
                    description: `${bytesText(file.size, props.locale)} \u00b7 ${file.mime}`,
                    leading: { position: position + 1, format: "hash" as const },
                    action: {
                        label: words({ key: "fileUploadRemove" }),
                        intent: "destructive" as const,
                        isDisabled: props.isDisabled,
                        press: () => setRemoving(file.key),
                    },
                    actionPlacement: "end" as const,
                }))}
                empty={<EmptyNotice message={words({ key: "fileUploadListEmpty" })} />}
            />
            <Text size="xs" tone="muted" isLoading={props.isLoading}>
                {words({ key: "fileUploadListCount" })
                    .replaceAll("{count}", String(props.items.length))
                    .replaceAll("{max}", String(props.max))}
            </Text>
            <AlertDialog
                isOpen={removing !== null}
                onOpenChange={(isOpen) => {
                    if (!isOpen) setRemoving(null)
                }}
                title={words({ key: "fileUploadRemoveTitle" })}
                description={words({ key: "fileUploadRemoveBody" })}
                confirmLabel={words({ key: "fileUploadRemove" })}
                cancelLabel={words({ key: "fileUploadCancel" })}
                onConfirm={() => props.onRemove(removing ?? "")}
            />
        </>
    )
}

/** Why the field cannot take a file now, in words: the host has no file store, or the record is not saved yet; null when it can. */
const blockedWordsOf = (
    files: BlockFiles | null,
    id: string,
    idle: SpecText | undefined,
    words: (text: SpecText) => string,
): string | null => {
    if (files === null) return words({ key: "fileUploadUnavailable" })
    return id === "" ? words(idle ?? { key: "fileUploadNeedsRecord" }) : null
}

/** What the list field's upload is given: the files it holds, what adds and removes them, and the words around the picker. */
interface FileListBodyProps {
    readonly block: RenderOf<typeof fileUploadBlock>
    readonly items: ReadonlyArray<FileRef>
    readonly max: number
    readonly limits: FileLimits
    readonly label: string
    readonly locale: string
    readonly upload: FileUploadView
    /** What stands under the picker: why it is blocked, or what it accepts. */
    readonly hint: string
    readonly problem: string | undefined
    readonly isDisabled: boolean
    readonly isLoading: boolean
}

/** A list field: its files in order, how many of the most it holds, the progress of a file going up, and a picker while there is room. */
const FileListBody = (props: FileListBodyProps): ReactNode => {
    const { upload, limits } = props
    const words = useBlockWords()
    const problemProps = props.problem === undefined ? {} : { errorMessage: props.problem }
    return (
        <SurfaceFrame surface={props.block.props.surface} label={props.label} isLoading={props.isLoading}>
            <Stack gap="row">
                <FileItems
                    items={props.items}
                    max={props.max}
                    label={props.label}
                    locale={props.locale}
                    isDisabled={props.isDisabled}
                    isLoading={props.isLoading}
                    words={words}
                    onRemove={upload.remove}
                />
                {upload.progress === null ? null : (
                    <Progress
                        label={words({ key: "fileUploadProgress" }).replaceAll("{name}", upload.progress.name)}
                        value={Math.round(upload.progress.share * 100)}
                    />
                )}
                {roomOf(limits, props.items.length) === 0 ? (
                    <Text size="xs" tone="muted">
                        {words({ key: "fileUploadListFull" })}
                    </Text>
                ) : (
                    <FileDropzone
                        label={props.label}
                        isLabelHidden
                        prompt={words({ key: "fileUploadListPrompt" })}
                        description={props.hint}
                        {...problemProps}
                        accept={limits.accept.join(",")}
                        multiple
                        hideFileList
                        isDisabled={props.isDisabled}
                        isLoading={props.isLoading}
                        onFilesChange={upload.choose}
                    />
                )}
            </Stack>
        </SurfaceFrame>
    )
}

/** What the single-file upload is given: the file on the field, what adds, replaces or removes it, and the words around the picker. */
interface SingleFileBodyProps {
    readonly block: RenderOf<typeof fileUploadBlock>
    readonly current: FileRef | null
    readonly limits: FileLimits
    readonly label: string
    readonly locale: string
    readonly upload: FileUploadView
    /** What stands under the picker: why it is blocked, or what it accepts. */
    readonly hint: string
    readonly isDisabled: boolean
    readonly isLoading: boolean
}

/** A field of one file: the file now on it, the progress of an upload, and a picker to add it or controls to replace or remove it. */
const SingleFileBody = (props: SingleFileBodyProps): ReactNode => {
    const { upload, limits, current } = props
    const words = useBlockWords()
    const problemProps = upload.problem === undefined ? {} : { errorMessage: upload.problem }
    return (
        <SurfaceFrame surface={props.block.props.surface} label={props.label} isLoading={props.isLoading}>
            <Stack gap="row">
                {current === null ? null : <CurrentFile file={current} locale={props.locale} isLoading={props.isLoading} />}
                {upload.progress === null ? null : (
                    <Progress
                        label={words({ key: "fileUploadProgress" }).replaceAll("{name}", upload.progress.name)}
                        value={Math.round(upload.progress.share * 100)}
                    />
                )}
                {current === null ? (
                    <FileDropzone
                        label={props.label}
                        isLabelHidden
                        prompt={words({ key: "fileUploadPrompt" })}
                        description={props.hint}
                        {...problemProps}
                        accept={limits.accept.join(",")}
                        hideFileList
                        isDisabled={props.isDisabled}
                        isLoading={props.isLoading}
                        onFilesChange={upload.choose}
                    />
                ) : (
                    <FileControls
                        accept={limits.accept.join(",")}
                        hint={props.hint}
                        problem={upload.problem}
                        isDisabled={props.isDisabled}
                        isLoading={props.isLoading}
                        words={words}
                        onPick={upload.choose}
                        onRemove={() => upload.remove()}
                    />
                )}
            </Stack>
        </SurfaceFrame>
    )
}

/** What the filled upload is given: the block, the bound record and the limits the declaration sets. */
interface UploadBodyProps {
    readonly block: RenderOf<typeof fileUploadBlock>
    readonly record: unknown
    readonly limits: FileLimits
    readonly isLoading: boolean
}

/** The types a field accepts, as the viewer's words. */
const typesWordsOf = (limits: FileLimits, words: (text: SpecText) => string): string =>
    acceptWordsOf(limits.accept, {
        image: words({ key: "fileFamilyImage" }),
        audio: words({ key: "fileFamilyAudio" }),
        video: words({ key: "fileFamilyVideo" }),
        text: words({ key: "fileFamilyText" }),
        application: words({ key: "fileFamilyApplication" }),
    })

/** What a field accepts and how large a file may be, as the line under its picker. */
const hintWordsOf = (limits: FileLimits, typesText: string, locale: string, words: (text: SpecText) => string): string =>
    words({ key: "fileUploadHint" })
        .replaceAll("{types}", typesText)
        .replaceAll("{size}", bytesText(limits.maxBytes, locale))

/** The file on the field, the progress of an upload, and what picks, replaces or removes a file. */
const UploadBody = (props: UploadBodyProps): ReactNode => {
    const { block, limits } = props
    const spec = block.props
    const host = useBlockHost()
    const words = useBlockWords()
    const files = useBlockFiles(BLOCK_ID)
    const id = recordIdOf(props.record, spec.idPath ?? "id")
    const items = fileItemsOf(limits, valueAt(props.record, spec.field))
    const current = items[0] ?? null
    const typesText = typesWordsOf(limits, words)
    const upload = useFileUpload({
        files,
        type: spec.type,
        id,
        field: spec.field,
        limits,
        count: items.length,
        words,
        typesText,
        onChanged: block.slots.record.retry,
    })
    const hint = hintWordsOf(limits, typesText, host.locale(), words)
    const blockedBy = blockedWordsOf(files, id, spec.idle, words)
    const isDisabled = blockedBy !== null || upload.progress !== null
    const label = words(spec.label)
    const shared = {
        block,
        limits,
        label,
        locale: host.locale(),
        upload,
        hint: blockedBy ?? hint,
        isDisabled,
        isLoading: props.isLoading,
    }
    if (limits.max !== null) return <FileListBody {...shared} items={items} max={limits.max} problem={upload.problem} />
    return <SingleFileBody {...shared} current={current} />
}

/**
 * Picks one file (or, for a list field, several, up to the field's maximum) for the declared file field of the bound record, from the
 * field's own declaration of what it accepts and how large it may be, and puts it there through the host's file port. A list field
 * shows its files in order with a remove control on each and how many of the most it holds. A file that breaks the declaration is refused before any byte is
 * sent. The file now on the field shows with its size and type; a replace control and a remove control (which confirms first) stand
 * under it, and a progress bar stands while a file goes up. With no record saved yet, or no file store behind the host, the
 * control is disabled and says why.
 */
export const FileUploadBlock = (props: RenderOf<typeof fileUploadBlock>): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.idle ?? { key: "fileUploadNeedsRecord" })
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
                <UploadBody block={props} record={record} limits={limits} isLoading={isLoading} />
            )}
        />
    )
}
