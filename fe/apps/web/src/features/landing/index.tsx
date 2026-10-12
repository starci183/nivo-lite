import { LandingCommitment } from "@/features/landing/bottom/commitment";
import { LandingFaq } from "@/features/landing/bottom/faq";
import { LandingFinalCta } from "@/features/landing/bottom/final-cta";
import { LandingFooter } from "@/features/landing/bottom/footer";
import { LandingOffer } from "@/features/landing/bottom/offer";
import { LandingConnect } from "./connect";
import { LandingFlow } from "./flow";
import { LandingHero } from "./hero";
import { LandingNav } from "./nav";
import { LandingProduct } from "./product";
import { LandingTrustStrip } from "./trust-strip";
import { MAIN } from "./classNames";

/** Public marketing page: template order, no console shell. `#top` is the footer's "back to top" anchor. */
export const Landing = () => (
  <div id="top">
    <LandingNav />
    <main className={MAIN}>
      <LandingHero />
      <LandingTrustStrip />
      <LandingProduct />
      <LandingFlow />
      <LandingConnect />
      <LandingOffer />
      <LandingCommitment />
      <LandingFinalCta />
      <LandingFaq />
    </main>
    <LandingFooter />
  </div>
);
