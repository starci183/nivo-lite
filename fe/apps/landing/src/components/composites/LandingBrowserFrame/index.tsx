import { Image, MediaFrame } from "@starci/grammar/common"

/** A product screenshot with its caption and the size the browser reserves for it. */
interface LandingBrowserFrameProps {
    readonly src: string
    readonly alt: string
    /** Visible caption under the shot; on the landing it always says the data is demo data. */
    readonly label: string
    readonly width: number
    readonly height: number
    readonly priority?: boolean
}

/** A real product screenshot framed by the grammar's media frame, always captioned as demo data. */
export const LandingBrowserFrame = (props: LandingBrowserFrameProps) => (
    <MediaFrame treatment="framed" aspect="auto" caption={props.label}>
        <Image
            src={props.src}
            alt={props.alt}
            width={props.width}
            height={props.height}
            aspect="auto"
            fit="contain"
            loading={props.priority === true ? "eager" : "lazy"}
        />
    </MediaFrame>
)
