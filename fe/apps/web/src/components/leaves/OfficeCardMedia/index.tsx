import { Grid, Image, MediaFrame, Video } from "@starci/grammar/common"
import type { OfficeResultCardView } from "@/modules/types"

/** What the media of a result card draws. */
type OfficeCardMediaProps = {
    readonly card: OfficeResultCardView
}

/** The images and videos of a result card (a video with its captions track when the editor made one); nothing without any. */
export const OfficeCardMedia = (props: OfficeCardMediaProps) =>
    props.card.media.length === 0 ? null : (
        <Grid kind="cards" columns={2}>
            {props.card.media.map((media) =>
                media.kind === "image" ? (
                    <Image key={media.url} src={media.url} alt={media.caption ?? props.card.title} aspect="landscape" />
                ) : (
                    <MediaFrame key={media.url} aspect="landscape" caption={media.caption ?? undefined}>
                        <Video
                            src={media.url}
                            title={props.card.title}
                            captions={media.captions}
                            {...(media.captions !== null && { crossOrigin: "anonymous" as const })}
                        />
                    </MediaFrame>
                ),
            )}
        </Grid>
    )
