import { Stack } from "@starci/grammar/common"
import { ContactHistoryCard } from "@/components/composites/ContactHistoryCard"
import { ContactIdentityCard } from "@/components/composites/ContactIdentityCard"
import { ContactMemoryCard } from "@/components/composites/ContactMemoryCard"
import { ContactModulesCard } from "@/components/composites/ContactModulesCard"
import { ContactNotesCard } from "@/components/composites/ContactNotesCard"
import { ContactSuggestionsList } from "@/components/composites/ContactSuggestionsList"
import type { ContactDetailView, ContactsPanesBaseProps } from "@/modules/types"

/** What the detail column draws and does. */
interface ContactDetailProps {
    readonly copy: ContactsPanesBaseProps["props"]["copy"]
    readonly person: ContactDetailView
    readonly history: ContactsPanesBaseProps["props"]["history"]
    readonly historyLabels: ContactsPanesBaseProps["props"]["historyLabels"]
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
        | "selectHistoryTab"
        | "historyOlder"
        | "retryHistory"
    >
}

/**
 * The open person as separate white blocks on the well, in the order the owner approved (drawing v2): who they are with the way each
 * identity is linked, their conversation across every channel, the work the agents did, what the agents remember, the blocks modules
 * mount, and the people they may be.
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
            }}
        />
        {props.history === null ? null : (
            <ContactHistoryCard
                copy={props.copy}
                history={props.history}
                labels={props.historyLabels}
                on={{
                    selectTab: props.on.selectHistoryTab,
                    older: props.on.historyOlder,
                    retry: props.on.retryHistory,
                }}
            />
        )}
        <ContactNotesCard copy={props.copy} notes={props.person.notes} isLoading={props.isLoading} />
        <ContactMemoryCard
            copy={props.copy}
            facts={props.person.facts}
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
        <ContactSuggestionsList
            copy={props.copy}
            suggestions={props.person.suggestions}
            isLoading={props.isLoading}
            onOpen={props.on.select}
            onMerge={props.on.askMergeSuggestion}
            onDismiss={props.on.dismissSuggestion}
        />
    </Stack>
)
