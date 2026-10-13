import { PageContainer } from "@starci/grammar/common"
import { ApiKeysSection } from "@/components/blocks/ApiKeysSection"
import { ApiQuickStart } from "@/components/blocks/ApiQuickStart"
import { DevelopersPanel } from "@/components/blocks/DevelopersPanel"
import { PAGE_CLASS } from "./classNames"

/** Props for {@link DevelopersPageBase}. */
export interface DevelopersPageBaseProps {
    readonly props: { readonly apiBase: string }
}

/** Draws the "Advanced" page: the head and outgoing events (or the 403), API keys and the quick guide; each connected block hides itself from staff. */
export const DevelopersPageBase = (props: DevelopersPageBaseProps) => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS}>
            <DevelopersPanel />
            <ApiKeysSection />
            <ApiQuickStart base={props.props.apiBase} />
        </div>
    </PageContainer>
)
