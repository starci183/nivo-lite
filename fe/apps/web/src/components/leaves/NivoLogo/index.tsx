import Image from "next/image"
import { LOGO } from "./classNames"

/** What the logo draws: "full" is the primary colour lockup, "os" the product lockup, "mark" the O mark. */
type NivoLogoProps = {
    readonly variant?: "full" | "os" | "mark" | undefined
    readonly height?: number | undefined
    /** The spoken name of the logo. */
    readonly label: string
}

/** The approved brand rasters (light surfaces only, never inverted) with their width-to-height ratio. */
const SOURCES = {
    full: { src: "/brand/nivo-logo.png", ratio: 322 / 114 },
    os: { src: "/brand/nivo-os.png", ratio: 284 / 90 },
    mark: { src: "/brand/nivo-mark.png", ratio: 154 / 156 },
} as const

/** The NIVO logo from the approved raster references. */
export const NivoLogo = (props: NivoLogoProps) => {
    const source = SOURCES[props.variant ?? "os"]
    const height = props.height ?? 28
    return (
        <Image
            className={LOGO}
            src={source.src}
            alt={props.label}
            width={Math.round(height * source.ratio)}
            height={height}
            priority
        />
    )
}
