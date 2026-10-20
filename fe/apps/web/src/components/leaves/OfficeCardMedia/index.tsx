import { Image, MediaFrame } from "@starci/grammar/common"
import type { OfficeResultCardView } from "@/modules/types"
import { MEDIA_GRID_CLASS_NAME } from "./classNames"

/** What the media of a result card draws. */
export type OfficeCardMediaProps = {
    readonly card: OfficeResultCardView
}

/** The images and videos of a result card; nothing without any. */
export const OfficeCardMedia = (props: OfficeCardMediaProps) =>
    props.card.media.length === 0 ? null : (
        <div className={MEDIA_GRID_CLASS_NAME}>
            {props.card.media.map((media) =>
                media.kind === "image" ? (
                    <Image key={media.url} src={media.url} alt={media.caption ?? props.card.title} aspect="landscape" />
                ) : (
                    <MediaFrame key={media.url} aspect="landscape" caption={media.caption ?? undefined}>
                        <video src={media.url} controls preload="metadata" playsInline aria-label={props.card.title} />
                    </MediaFrame>
                ),
            )}
        </div>
    )
