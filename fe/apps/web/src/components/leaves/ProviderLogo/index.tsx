import { IconTile, Image } from "@starci/grammar/common"
import { nivoIconSource } from "@/ui"
import type { IconName } from "@/ui"
import { providerLogoClassNames } from "./classNames"

/** What the logo draws: a provider mark in a neutral tile, or a bank wordmark. */
type ProviderLogoProps = {
    /** The mark or wordmark image; absent shows the glyph alone. */
    readonly src?: string
    /** The tile glyph used when there is no mark (outgoing email keeps the envelope). */
    readonly glyph: IconName
    /** A bank wordmark is a horizontal logo: it gets a 64x40 frame instead of a square tile. */
    readonly isWordmark?: boolean
}

/** The provider's own mark in a neutral tile, or a bank's wordmark in its frame. Decorative: the name sits beside it. */
export const ProviderLogo = (props: ProviderLogoProps) => {
    if (props.isWordmark === true && props.src !== undefined) {
        return (
            <Image
                src={props.src}
                alt=""
                aspect="auto"
                fit="contain"
                plate="none"
                width={64}
                height={26}
                className={providerLogoClassNames.wordmark}
            />
        )
    }
    return (
        <IconTile
            source={nivoIconSource(props.glyph, "leading")}
            tone="neutral"
            size="md"
            artwork={
                props.src === undefined ? undefined : (
                    <Image
                        src={props.src}
                        alt=""
                        aspect="square"
                        fit="contain"
                        width={28}
                        height={28}
                        className={providerLogoClassNames.mark}
                    />
                )
            }
        />
    )
}
