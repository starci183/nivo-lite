import { NivoLogo } from "../../leaves/NivoLogo"

/** Copy and size supplied by the connected brand logo block. */
export interface BrandLogoBaseProps {
    readonly props: {
        readonly variant?: "full" | "os" | "mark" | undefined
        readonly height?: number | undefined
        readonly label: string
    }
}

/** Draws the brand logo from resolved copy without reading the locale. */
export const BrandLogoBase = (props: BrandLogoBaseProps) => (
    <NivoLogo variant={props.props.variant} height={props.props.height} label={props.props.label} />
)
