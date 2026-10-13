import { WorkspaceShell } from "@starci/grammar/common"
import { LandingCommitment } from "@/components/blocks/LandingCommitment"
import { LandingConnect } from "@/components/blocks/LandingConnect"
import { LandingFaq } from "@/components/blocks/LandingFaq"
import { LandingFinalCta } from "@/components/blocks/LandingFinalCta"
import { LandingFlow } from "@/components/blocks/LandingFlow"
import { LandingFooter } from "@/components/blocks/LandingFooter"
import { LandingHero } from "@/components/blocks/LandingHero"
import { LandingNav } from "@/components/blocks/LandingNav"
import { LandingOffer } from "@/components/blocks/LandingOffer"
import { LandingProduct } from "@/components/blocks/LandingProduct"
import { LandingTrustStrip } from "@/components/blocks/LandingTrustStrip"
import { MAIN } from "./classNames"

/** Whether the reader is signed in and the name of the page's main region. */
interface LandingPageBaseProps {
    readonly props: {
        readonly isSignedIn: boolean
        readonly mainLabel: string
    }
}

/** Public marketing page: template order, no console shell. `#top` is the footer's "back to top" anchor. */
export const LandingPageBase = (props: LandingPageBaseProps) => (
    <WorkspaceShell
        header={<LandingNav anchorBase="" isSignedIn={props.props.isSignedIn} />}
        primaryLabel={props.props.mainLabel}
        primaryId="top"
        primary={
            <div className={MAIN}>
                <LandingHero />
                <LandingTrustStrip />
                <LandingProduct />
                <LandingFlow />
                <LandingConnect />
                <LandingOffer />
                <LandingCommitment />
                <LandingFinalCta />
                <LandingFaq />
                <LandingFooter anchorBase="" />
            </div>
        }
    />
)
