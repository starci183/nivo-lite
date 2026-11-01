import { FileDropzone, Icon } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { CHAT_FILE_PICKER_CLASS_NAME } from "./classNames"

/** The words and state of the file picker of a composer. */
interface ChatFilePickerProps {
    readonly label: string
    /** The types the picker offers; a hint, the back end checks the bytes. */
    readonly accept: string
    readonly isDisabled: boolean
    readonly onFile: (file: File) => void
}

/** The attach control of a composer: the Grammar drop target at the size of a button, so a file is picked or dropped on it. */
export const ChatFilePicker = (props: ChatFilePickerProps) => (
    <div className={CHAT_FILE_PICKER_CLASS_NAME}>
        <FileDropzone
            label={props.label}
            isLabelHidden
            accept={props.accept}
            prompt={<Icon source={nivoIconSource("attach", "leading")} usage="leading" />}
            isDisabled={props.isDisabled}
            hideFileList
            onFilesChange={(files) => {
                const chosen = files.at(0)
                if (chosen !== undefined) props.onFile(chosen)
            }}
        />
    </div>
)
