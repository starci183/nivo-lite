import type { ReactNode } from "react"
import { BrandLogo } from "@/components/blocks/BrandLogo"
import { LocaleSwitch } from "@/components/blocks/LocaleSwitch"
import { WorkspacesAccount } from "@/components/blocks/WorkspacesAccount"
import { WorkspacesFrame } from "@/components/composites/WorkspacesFrame"
import { AUTH_ROUTES } from "@/modules/routes"

/** The words of the first-run frame, resolved by the layout. */
export interface FirstRunLayoutBaseProps {
    readonly props: { readonly mainLabel: string }
    readonly children: ReactNode
}

/** Draws the bar of the first-run wizard (logo, language switch, account menu) once around every step. */
export const FirstRunLayoutBase = (props: FirstRunLayoutBaseProps) => (
    <WorkspacesFrame
        homeHref={AUTH_ROUTES.workspaces}
        mainLabel={props.props.mainLabel}
        logo={<BrandLogo variant="full" height={40} />}
        localeSwitch={<LocaleSwitch />}
        account={<WorkspacesAccount />}
    >
        {props.children}
    </WorkspacesFrame>
)
