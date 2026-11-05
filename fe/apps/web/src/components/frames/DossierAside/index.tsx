import {
    Button,
    DescriptionList,
    Heading,
    Icon,
    IconTile,
    ListBox,
    PaneSection,
    Stack,
    Text,
} from "@starci/grammar/common"
import { PaneHead } from "@/components/composites/PaneHead"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { DossierAsideView } from "@/hooks/brain"

/** What the side pane of the open dossier draws. */
interface DossierAsideProps {
    readonly aside: DossierAsideView
    readonly isWaiting: boolean
    /** Closes the pane (drawn from the wide width, where the pane is a column with no drawer close). */
    readonly close: { readonly label: string; readonly onPress: () => void }
    /** Opens a document of the dossier. */
    readonly onOpenDocument: (id: string) => void
}

/** What is missing in words, with the one filled command that brings it. */
const Missing = (props: Pick<DossierAsideProps, "aside" | "isWaiting">) => {
    const missing = props.aside.missing
    if (missing === null) return null
    return (
        <Stack gap="row">
            <Heading level={3} isLoading={props.isWaiting}>
                {missing.title}
            </Heading>
            <Text size="sm" isLoading={props.isWaiting}>
                {missing.text}
            </Text>
            {missing.upload === null ? null : (
                <Button
                    intent="commit"
                    width="fill"
                    startContent={<Icon source={nivoIconSource("upload", "leading")} usage="leading" />}
                    href={missing.upload.href}
                >
                    {missing.upload.label}
                </Button>
            )}
        </Stack>
    )
}

/**
 * The side pane of the open dossier: its head with the way to close it, what the dossier lacks with the one command that brings
 * it, and the documents filed under it.
 */
export const DossierAside = (props: DossierAsideProps) => {
    const { aside } = props
    return (
        <>
            <PaneHead title={aside.title} headingLevel={2} isLoading={props.isWaiting} close={props.close} />
            <PaneSection gap="section">
                <Missing aside={aside} isWaiting={props.isWaiting} />
                <DescriptionList
                    items={aside.details.map((one) => ({ id: one.id, term: one.term, description: one.text }))}
                    isLoading={props.isWaiting}
                />
                <Stack gap="row">
                    <Heading level={3} isLoading={props.isWaiting}>
                        {aside.documentsTitle}
                    </Heading>
                    {aside.documents.length === 0 && !props.isWaiting ? (
                        <Text tone="muted">{aside.documentsEmpty}</Text>
                    ) : (
                        <ListBox
                            label={aside.documentsTitle}
                            isLoading={props.isWaiting}
                            onAction={props.onOpenDocument}
                            items={aside.documents.map((document) => ({
                                id: document.id,
                                label: document.title,
                                description: document.meta,
                                leading: <IconTile source={nivoIconSource("document", "leading")} tone="neutral" />,
                            }))}
                        />
                    )}
                </Stack>
            </PaneSection>
        </>
    )
}
