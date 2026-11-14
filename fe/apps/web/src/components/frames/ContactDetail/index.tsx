import { Stack } from "@starci/grammar/common"
import { ContactIdentityCard } from "@/components/composites/ContactIdentityCard"
import { ContactMemoryCards } from "@/components/composites/ContactMemoryCards"
import { ContactModulesCard } from "@/components/composites/ContactModulesCard"
import type { ContactDetailView, ContactsPanesBaseProps } from "@/modules/types"

/** What the detail column draws and does. */
interface ContactDetailProps {
    readonly copy: ContactsPanesBaseProps["props"]["copy"]
    readonly person: ContactDetailView
    readonly modules: ContactsPanesBaseProps["props"]["modules"]
    readonly modulesLabels: ContactsPanesBaseProps["props"]["modulesLabels"]
    readonly isLoading: boolean
    readonly on: Pick<
        ContactsPanesBaseProps["on"],
        | "openEdit"
        | "openLink"
        | "openMerge"
        | "askUnlink"
        | "askDelete"
        | "askMergeSuggestion"
        | "dismissSuggestion"
        | "forget"
        | "select"
        | "retryModules"
    >
}

/**
 * The open person as cards stacked on the well, in the order the owner approved: who they are with their identities and the reason
 * each joined (and the people they may be, as a list inside that card), what the agents remember, and the
 * blocks modules mount.
 */
export const ContactDetail = (props: ContactDetailProps) => (
    <Stack gap="section">
        <ContactIdentityCard
            copy={props.copy}
            person={props.person}
            isLoading={props.isLoading}
            on={{
                edit: props.on.openEdit,
                link: props.on.openLink,
                merge: props.on.openMerge,
                unlink: props.on.askUnlink,
                remove: props.on.askDelete,
                open: props.on.select,
                mergeSuggestion: props.on.askMergeSuggestion,
                dismissSuggestion: props.on.dismissSuggestion,
            }}
        />
        <ContactMemoryCards
            copy={props.copy}
            facts={props.person.facts}
            notes={props.person.notes}
            isLoading={props.isLoading}
            onForget={props.on.forget}
        />
        {props.modules === null ? null : (
            <ContactModulesCard
                copy={props.copy}
                modules={props.modules}
                labels={props.modulesLabels}
                onRetry={props.on.retryModules}
            />
        )}
    </Stack>
)
