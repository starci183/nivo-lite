import type { ChatMessageFile } from "@/modules/types"
import { Link, Stack } from "@starci/grammar/common"
import { CHAT_IMAGE_CLASS_NAME } from "./classNames"
/** What {@link ChatMessageFiles} draws. */
interface ChatMessageFilesProps {
    readonly files: ReadonlyArray<ChatMessageFile>
}
/** The files under a chat bubble: a picture is shown and opens in full, any other file is a link. */
export const ChatMessageFiles = (props: ChatMessageFilesProps) => {
    const files = props.files.map((file) => ({
        file,
        media: { src: file.url, alt: file.name, aspect: "auto" as const, fit: "contain" as const },
    }))
    return (
        <Stack gap="inline">
            {files.map(({ file, media }) =>
                file.contentType.startsWith("image/") ? (
                    <div key={file.id} className={CHAT_IMAGE_CLASS_NAME}>
                        <Link href={file.url} kind="external" label={file.name} media={media} />
                    </div>
                ) : (
                    <Link key={file.id} href={file.url} kind="external">
                        {file.name}
                    </Link>
                ),
            )}
        </Stack>
    )
}
