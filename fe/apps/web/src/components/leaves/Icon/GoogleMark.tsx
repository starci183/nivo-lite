import Image from "next/image"
import type { SVGProps } from "react"
import { GOOGLE_MARK } from "./classNames"

/** What Google's mark takes: the SVG props a glyph source receives. */
type GoogleMarkProps = SVGProps<SVGSVGElement>

/**
 * Google's mark: a static asset, because the provider's own colours may not be redrawn as source colours. It still keeps
 * Grammar's A11Y-2 contract: named by the caller's label when the mark carries meaning, hidden when it is decorative.
 */
export const GoogleMark = (props: GoogleMarkProps) => (
    <Image
        src="/brand/google-mark.svg"
        alt={props["aria-label"] ?? ""}
        width={24}
        height={24}
        className={GOOGLE_MARK}
        aria-hidden={props["aria-hidden"]}
    />
)
