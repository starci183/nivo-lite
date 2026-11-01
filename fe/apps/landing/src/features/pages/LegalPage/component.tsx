import { Alert, Page, Stack } from "@starci/grammar/common"
import { LandingFooter } from "@/components/blocks/LandingFooter"
import { LandingNavActions } from "@/components/blocks/LandingNavActions"
import { LandingNavBrand } from "@/components/blocks/LandingNavBrand"
import { LandingNavLinks } from "@/components/blocks/LandingNavLinks"
import { LegalSectionView } from "@/components/composites/LegalSectionView"
import { SiteShell } from "@/components/composites/SiteShell"

/** One block of the document, as plain words. */
interface LegalPageSection {
    readonly id: string
    readonly title: string
    readonly paragraphs: ReadonlyArray<string>
    readonly items: ReadonlyArray<string>
    readonly afterItems: ReadonlyArray<string>
    readonly hasLimitedUse: boolean
}

/** The Google Limited Use statement a section may end with. */
interface LegalPageLimitedUse {
    readonly sentence: string
    readonly policyUrl: string
    /** An explanation in the reader's language; empty when the sentence already is in it. */
    readonly note: string
}

/** The resolved document and what the chrome needs. */
interface LegalPageBaseProps {
    readonly props: {
        readonly mainLabel: string
        readonly title: string
        readonly draft: string
        readonly intro: string
        readonly sections: ReadonlyArray<LegalPageSection>
        readonly limitedUse: LegalPageLimitedUse
    }
}

/** A public legal document on the landing chrome. The wording is a draft until the owner and a lawyer approve it. */
export const LegalPageBase = (props: LegalPageBaseProps) => (
    <SiteShell
        mainLabel={props.props.mainLabel}
        brand={<LandingNavBrand />}
        navigation={<LandingNavLinks anchorBase="/" />}
        actions={<LandingNavActions />}
    >
        <Page measure="reading" header={{ title: props.props.title, description: props.props.intro }}>
            <Stack gap="section">
                <Alert tone="cautionary" title={props.props.draft} />
                {props.props.sections.map((section) => (
                    <LegalSectionView
                        key={section.id}
                        id={section.id}
                        title={section.title}
                        paragraphs={section.paragraphs}
                        items={section.items}
                        afterItems={section.afterItems}
                        limitedUse={section.hasLimitedUse ? props.props.limitedUse : null}
                    />
                ))}
            </Stack>
            <LandingFooter anchorBase="/" />
        </Page>
    </SiteShell>
)
