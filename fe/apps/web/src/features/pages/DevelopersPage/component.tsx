import { ApiKeysSection } from "@/components/blocks/ApiKeysSection"
import { ApiQuickStart } from "@/components/blocks/ApiQuickStart"
import { ClaudeConnectCard } from "@/components/blocks/ClaudeConnectCard"
import { DevelopersPanel } from "@/components/blocks/DevelopersPanel"

/** Props for {@link DevelopersPageBase}. */
export interface DevelopersPageBaseProps {
    readonly props: { readonly apiBase: string }
}

/** Draws the "Developers" page: the head and outgoing events (owner and manager), the Claude connection, the keys and the quick guide (all owner and manager only; staff see the "no access" notice). */
export const DevelopersPageBase = (props: DevelopersPageBaseProps) => (
    <DevelopersPanel>
        <>
            <ClaudeConnectCard />
            <ApiKeysSection />
            <ApiQuickStart base={props.props.apiBase} />
        </>
    </DevelopersPanel>
)
