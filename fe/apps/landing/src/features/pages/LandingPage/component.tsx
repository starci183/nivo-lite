import { Page, Stack } from "@starci/grammar/common"
import { LandingCommitment } from "@/components/blocks/LandingCommitment"
import { LandingConnect } from "@/components/blocks/LandingConnect"
import { LandingFaq } from "@/components/blocks/LandingFaq"
import { LandingFinalCta } from "@/components/blocks/LandingFinalCta"
import { LandingFlow } from "@/components/blocks/LandingFlow"
import { LandingFooter } from "@/components/blocks/LandingFooter"
import { LandingHero } from "@/components/blocks/LandingHero"
import { LandingNavActions } from "@/components/blocks/LandingNavActions"
import { LandingNavBrand } from "@/components/blocks/LandingNavBrand"
import { LandingNavLinks } from "@/components/blocks/LandingNavLinks"
import { LandingOffer } from "@/components/blocks/LandingOffer"
import { LandingProduct } from "@/components/blocks/LandingProduct"
import { LandingTrustStrip } from "@/components/blocks/LandingTrustStrip"
import { SiteShell } from "@/components/composites/SiteShell"

/** The name of the page's main region. */
interface LandingPageBaseProps {
    readonly props: {
        readonly mainLabel: string
    }
}

/** Public marketing page: template order, no console shell. `#top` is the footer's "back to top" anchor. */
export const LandingPageBase = (props: LandingPageBaseProps) => (
    <SiteShell
        mainLabel={props.props.mainLabel}
        mainId="top"
        brand={<LandingNavBrand />}
        navigation={<LandingNavLinks anchorBase="" />}
        actions={<LandingNavActions />}
    >
        <Page measure="product">
            <Stack gap="region">
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
            </Stack>
        </Page>
    </SiteShell>
)
