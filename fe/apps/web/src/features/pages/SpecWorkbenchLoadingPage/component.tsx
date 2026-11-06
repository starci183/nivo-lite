import { Page, Section } from "@starci/grammar/common"

/** The generic workbench while it loads: the rows of the body, drawn by the Grammar's own loading state at once. */
export const SpecWorkbenchLoadingPageBase = () => (
    <Page measure="full" isLoading>
        <Section kind="list" title="-" items={[]} empty={null} isLoading />
    </Page>
)
