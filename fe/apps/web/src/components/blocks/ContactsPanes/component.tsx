import { AlertDialog, EmptyNotice, Grid, Page, SearchField, Stack } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ContactEditDrawer } from "@/components/composites/ContactEditDrawer"
import { ContactLinkDrawer } from "@/components/composites/ContactLinkDrawer"
import { ContactListCard } from "@/components/composites/ContactListCard"
import { ContactMergeDrawer } from "@/components/composites/ContactMergeDrawer"
import { ContactDetail } from "@/components/frames/ContactDetail"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { ContactDetailView, ContactsListData, ContactsPanesBaseProps } from "@/modules/types"

type Props = ContactsPanesBaseProps

/** The list while it is read: five rows of the same shape as the real ones, drawn as geometry. */
const LIST_PLACEHOLDER: ContactsListData = {
    rows: ["a", "b", "c", "d", "e"].map((id) => ({ id: `contact:${id}`, name: " ", time: " ", channels: [], isUnknown: false })),
    hasMore: false,
}

/** The open person while it is read: one of each kind of row, so every card keeps its ready box. */
const DETAIL_PLACEHOLDER: ContactDetailView = {
    id: "contact:placeholder",
    name: " ",
    initial: " ",
    line: " ",
    displayName: " ",
    tags: [],
    identities: [{ id: "identity:a", title: " ", value: " ", proof: " ", logo: null, reason: " " }],
    facts: [{ name: " ", value: " " }],
    notes: [],
    suggestions: [],
    canDelete: false,
}

/** The list column: the people, through the slot recipe (skeleton, failure with retry, nobody at all). */
const ListColumn = (props: Props) => (
    <SlotView
        slot={props.props.list}
        placeholder={LIST_PLACEHOLDER}
        labels={props.props.listLabels}
        errorLayout="band"
        errorDescription={props.props.copy.errorBody}
        emptyDescription={props.props.copy.emptyBody}
        emptyIconSource={nivoIconSource("community", "leading")}
        onRetry={props.on.retryList}
        render={(data, isSkeleton) => (
            <ContactListCard
                copy={props.props.copy}
                data={data}
                selectedId={props.props.selectedId}
                isLoading={isSkeleton}
                onSelect={props.on.select}
                onMore={props.on.loadMore}
            />
        )}
    />
)

/** The detail column: the person the address names, the invitation to pick one, or the notice staff and a missing person get. */
const DetailColumn = (props: Props) => {
    const { copy } = props.props
    if (props.props.access === "staff") {
        return (
            <EmptyNotice
                message={copy.forbiddenTitle}
                iconSource={nivoIconSource("profile", "leading")}
                description={copy.forbiddenBody}
                actionLabel={copy.forbiddenAction}
                actionEndArrow
                onAction={props.on.goHome}
            />
        )
    }
    if (props.props.detail === null) {
        return (
            <EmptyNotice
                message={copy.pickTitle}
                iconSource={nivoIconSource("community", "leading")}
                description={copy.pickBody}
            />
        )
    }
    return (
        <SlotView
            slot={props.props.detail}
            placeholder={DETAIL_PLACEHOLDER}
            labels={props.props.detailLabels}
            errorLayout="band"
            errorDescription={copy.errorBody}
            emptyDescription={copy.goneBody}
            emptyAction={{ label: copy.goneAction, onAction: props.on.goList }}
            onRetry={props.on.retryDetail}
            render={(person, isSkeleton) => (
                <ContactDetail
                    copy={copy}
                    person={person}
                    modules={props.props.modules}
                    modulesLabels={props.props.modulesLabels}
                    isLoading={isSkeleton}
                    on={props.on}
                />
            )}
        />
    )
}

/** The page header: the title with its line, and the search of the people at its end (only for who may read them). */
const headerOf = (props: Props) => ({
    breadcrumbs: "root" as const,
    title: props.props.copy.title,
    description: props.props.copy.description,
    ...(props.props.access === "manager"
        ? {
              actions: (
                  <SearchField
                      label={props.props.copy.searchLabel}
                      isLabelHidden
                      placeholder={props.props.copy.searchPlaceholder}
                      clearLabel={props.props.copy.clearSearch}
                      value={props.props.query}
                      onValueChange={props.on.setQuery}
                      onClear={() => props.on.setQuery("")}
                  />
              ),
          }
        : {}),
})

/** The question asked before a person is deleted, a way of reaching them is cut or two people become one. */
const Confirmation = (props: Props) => {
    const confirm = props.props.confirm
    return (
        <AlertDialog
            isOpen={confirm !== undefined}
            onOpenChange={(isOpen) => {
                if (!isOpen) props.on.cancelConfirm()
            }}
            title={confirm?.title ?? ""}
            description={confirm?.description}
            tone={confirm?.kind === "neutral" ? "neutral" : "negative"}
            confirmLabel={confirm?.confirmLabel ?? ""}
            cancelLabel={props.props.copy.cancelLabel}
            isConfirmPending={confirm?.isPending ?? false}
            onConfirm={props.on.acceptConfirm}
            onCancel={props.on.cancelConfirm}
        />
    )
}

/** The drawers over the page: edit the person, link an identity, pick who to merge. */
const Drawers = (props: Props) => (
    <>
        <ContactEditDrawer
            view={props.props.edit}
            copy={props.props.copy.edit}
            cancelLabel={props.props.copy.cancelLabel}
            closeLabel={props.props.copy.cancelLabel}
            on={{
                close: props.on.closeEdit,
                setName: props.on.setEditName,
                setTags: props.on.setEditTags,
                submit: props.on.submitEdit,
            }}
        />
        <ContactLinkDrawer
            view={props.props.link}
            copy={props.props.copy.link}
            cancelLabel={props.props.copy.cancelLabel}
            closeLabel={props.props.copy.cancelLabel}
            on={{
                close: props.on.closeLink,
                setKind: props.on.setLinkKind,
                setValue: props.on.setLinkValue,
                submit: props.on.submitLink,
            }}
        />
        <ContactMergeDrawer
            view={props.props.merge}
            copy={props.props.copy.merge}
            cancelLabel={props.props.copy.cancelLabel}
            closeLabel={props.props.copy.cancelLabel}
            on={{
                close: props.on.closeMerge,
                setQuery: props.on.setMergeQuery,
                choose: props.on.chooseMerge,
                submit: props.on.submitMerge,
            }}
        />
    </>
)

/**
 * Draws the people the agents work with: the list as one card on the well with the open person's cards beside it, so the person the
 * address names is the one filled in the list. A phone shows the open person first, and the list when none is open. Staff are told
 * the page is for owners and managers.
 */
export const ContactsPanesBase = (props: ContactsPanesBaseProps) => (
    <Page header={headerOf(props)}>
        <Grid
            kind="main-rail"
            railPosition="leading"
            railWidth="compact"
            align="start"
            collapsedOrder={props.props.selectedId === null ? "rail-first" : "primary-first"}
            primary={
                <Stack gap="section">
                    <DetailColumn {...props} />
                    <Confirmation {...props} />
                    <Drawers {...props} />
                </Stack>
            }
            rail={props.props.access === "manager" ? <ListColumn {...props} /> : undefined}
        />
    </Page>
)
