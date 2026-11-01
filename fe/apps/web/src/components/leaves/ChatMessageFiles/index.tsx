import { Image, Link, Stack } from "@starci/grammar/common"
import { CHAT_IMAGE_CLASS_NAME } from "./classNames"

/** A file that came with a message. */
export interface ChatMessageFile {
    readonly id: string
    readonly name: string
    readonly contentType: string
    readonly url: string
}

/** What {@link ChatMessageFiles} draws. */
interface ChatMessageFilesProps {
    readonly files: ReadonlyArray<ChatMessageFile>
}

/** The files under a chat bubble: a picture is shown and opens in full, any other file is a link. */
export const ChatMessageFiles = (props: ChatMessageFilesProps) => (
    <Stack gap="inline">
        {props.files.map((file) =>
            file.contentType.startsWith("image/") ? (
                <div key={file.id} className={CHAT_IMAGE_CLASS_NAME}>
                    <Link href={file.url} kind="external">
                        <Image src={file.url} alt={file.name} aspect="auto" fit="contain" />
                    </Link>
                </div>
            ) : (
                <Link key={file.id} href={file.url} kind="external">
                    {file.name}
                </Link>
            ),
        )}
    </Stack>
)
