import { Image, MediaFrame, Video } from "@starci/grammar/common"
import type { OfficeResultCardView } from "@/modules/types"
import { MEDIA_GRID_CLASS_NAME } from "./classNames"

/** What the media of a result card draws. */
type OfficeCardMediaProps = {
    readonly card: OfficeResultCardView
}

/** The images and videos of a result card (a video with its captions track when the editor made one); nothing without any. */
export const OfficeCardMedia = (props: OfficeCardMediaProps) =>
    props.card.media.length === 0 ? null : (
        <div className={MEDIA_GRID_CLASS_NAME}>
            {props.card.media.map((media) =>
                media.kind === "image" ? (
                    <Image key={media.url} src={media.url} alt={media.caption ?? props.card.title} aspect="landscape" />
                ) : (
                    <MediaFrame key={media.url} aspect="landscape" caption={media.caption ?? undefined}>
                        <Video
                            src={media.url}
                            title={props.card.title}
                            captions={media.captions}
                            crossOrigin={media.captions === null ? undefined : "anonymous"}
                        />
                    </MediaFrame>
                ),
            )}
        </div>
    )
