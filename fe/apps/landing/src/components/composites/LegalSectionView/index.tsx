import { Heading, List, ListItem, Region, Text, TextAction } from "@starci/grammar/common"
import { LEGAL_SECTION } from "./classNames"

/** The Google Limited Use statement, quoted verbatim, with its link and a note. */
interface LegalSectionLimitedUse {
    readonly sentence: string
    readonly policyUrl: string
    readonly note: string
}

/** One section of a legal document. */
interface LegalSectionViewProps {
    readonly id: string
    readonly title: string
    readonly paragraphs: ReadonlyArray<string>
    readonly items: ReadonlyArray<string>
    readonly afterItems: ReadonlyArray<string>
    readonly limitedUse: LegalSectionLimitedUse | null
}

/** A titled section: paragraphs, a list, closing paragraphs and, for Google data, the Limited Use statement. */
export const LegalSectionView = (props: LegalSectionViewProps) => (
    <Region id={props.id} label={props.title}>
        <div className={LEGAL_SECTION}>
            <Heading level={2}>{props.title}</Heading>
            {props.paragraphs.map((paragraph) => (
                <Text key={paragraph}>{paragraph}</Text>
            ))}
            {props.items.length === 0 ? null : (
                <List label={props.title}>
                    {props.items.map((item) => (
                        <ListItem key={item}>
                            <Text>{item}</Text>
                        </ListItem>
                    ))}
                </List>
            )}
            {props.afterItems.map((paragraph) => (
                <Text key={paragraph}>{paragraph}</Text>
            ))}
            {props.limitedUse === null ? null : (
                <>
                    <Text>{props.limitedUse.sentence}</Text>
                    <Text size="sm">
                        <TextAction href={props.limitedUse.policyUrl} target="_blank" rel="noopener noreferrer">
                            {props.limitedUse.policyUrl}
                        </TextAction>
                    </Text>
                    {props.limitedUse.note === "" ? null : <Text tone="muted">{props.limitedUse.note}</Text>}
                </>
            )}
        </div>
    </Region>
)
