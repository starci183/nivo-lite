import { Alert, Button, FileDropzone, SurfaceCard, Text } from "@starci/grammar/common"
import { WAYS_CLASS_NAME, ZONE_CLASS_NAME } from "./classNames"

/** One way in other than dropping a file: a link, a written note, Google Drive. */
export interface DropWayView {
    readonly id: string
    readonly label: string
    readonly onPress: () => void
}

/** Props for {@link DocumentDropZone}. */
interface DocumentDropZoneProps {
    readonly label: string
    readonly prompt: string
    readonly hint: string
    readonly ways: ReadonlyArray<DropWayView>
    /** Where the Google Drive grant stands, in words; nothing is drawn for it while undefined. */
    readonly driveNote?: string | undefined
    /** Why the last Drive action failed. */
    readonly driveFailure?: string | undefined
    readonly isDisabled: boolean
    readonly onFiles: (files: Array<File>) => void
}

/** The one place documents come in: drop files here, or take another way in (a link, a written note, Google Drive). */
export const DocumentDropZone = (props: DocumentDropZoneProps) => (
    <SurfaceCard label={props.label} headingLevel={2}>
        <div className={ZONE_CLASS_NAME}>
            <FileDropzone
                id="brain-drop-files"
                name="files"
                label={props.prompt}
                description={props.hint}
                prompt={props.prompt}
                multiple
                hideFileList
                isDisabled={props.isDisabled}
                onFilesChange={props.onFiles}
            />
            <div className={WAYS_CLASS_NAME}>
                {props.ways.map((way) => (
                    <Button key={way.id} intent="neutral" isDisabled={props.isDisabled} onPress={way.onPress}>
                        {way.label}
                    </Button>
                ))}
            </div>
            {props.driveNote === undefined ? null : (
                <Text size="sm" tone="muted">
                    {props.driveNote}
                </Text>
            )}
            {props.driveFailure === undefined ? null : <Alert tone="negative" title={props.driveFailure} />}
        </div>
    </SurfaceCard>
)
