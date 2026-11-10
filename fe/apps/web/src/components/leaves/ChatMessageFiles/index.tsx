import type { ChatMessageFile } from "@/modules/types"
import { Grid, Link, Stack } from "@starci/grammar/common"
import { CHAT_ALBUM_CLASS_NAME, CHAT_IMAGE_CLASS_NAME } from "./classNames"

/** What {@link ChatMessageFiles} draws. */
interface ChatMessageFilesProps {
    readonly files: ReadonlyArray<ChatMessageFile>
}

/** One picture of a thread as a destination: it is shown and opens in full. A lone picture (a photo, a payment QR) keeps its own shape; an album's pictures are squares. */
interface PictureLinkProps {
    readonly file: ChatMessageFile
    readonly isAlbum: boolean
}

const PictureLink = (props: PictureLinkProps) => (
    <Link
        href={props.file.url}
        kind="external"
        label={props.file.name}
        media={{
            src: props.file.url,
            alt: props.file.name,
            aspect: props.isAlbum ? "square" : "auto",
            fit: props.isAlbum ? "cover" : "contain",
        }}
    />
)

/**
 * The files under a chat bubble or agent card: one picture (a photo, a payment QR) is shown whole and opens in full, two or more
 * pictures are an album in a two-column grid, any other file is a link.
 */
export const ChatMessageFiles = (props: ChatMessageFilesProps) => {
    const pictures = props.files.filter((file) => file.contentType.startsWith("image/"))
    const others = props.files.filter((file) => !file.contentType.startsWith("image/"))
    const isAlbum = pictures.length > 1
    const albumOrPictures = isAlbum ? (
        <div className={CHAT_ALBUM_CLASS_NAME}>
            <Grid kind="cards" columns={2}>
                {pictures.map((file) => (
                    <PictureLink key={file.id} file={file} isAlbum />
                ))}
            </Grid>
        </div>
    ) : (
        pictures.map((file) => (
            <div key={file.id} className={CHAT_IMAGE_CLASS_NAME}>
                <PictureLink file={file} isAlbum={false} />
            </div>
        ))
    )
    return (
        <Stack gap="inline">
            {albumOrPictures}
            {others.map((file) => (
                <Link key={file.id} href={file.url} kind="external">
                    {file.name}
                </Link>
            ))}
        </Stack>
    )
}
