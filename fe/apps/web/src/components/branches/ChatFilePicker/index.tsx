import { FileButton } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"

/** The words and state of the file picker of a composer. */
interface ChatFilePickerProps {
    readonly label: string
    /** The types the picker offers; a hint, the back end checks the bytes. */
    readonly accept: string
    readonly isDisabled: boolean
    readonly onFile: (file: File) => void
}

/** The attach control of a composer: the Grammar file button, a glyph-only button the size of a composer's other icon buttons. */
export const ChatFilePicker = (props: ChatFilePickerProps) => (
    <FileButton
        label={props.label}
        source={nivoIconSource("attach", "leading")}
        accept={props.accept}
        isDisabled={props.isDisabled}
        onFilesChange={(files) => {
            const chosen = files.at(0)
            if (chosen !== undefined) props.onFile(chosen)
        }}
    />
)
