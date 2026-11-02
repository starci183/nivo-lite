import { EmptyNotice, Link, Section, Stack, SurfaceCard, Text } from "@starci/grammar/common"

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
    <Section id={props.id} title={props.title}>
        <Stack gap="row">
            {props.paragraphs.map((paragraph) => (
                <Text key={paragraph}>{paragraph}</Text>
            ))}
            {props.items.length === 0 ? null : (
                <SurfaceCard
                    kind="list"
                    ariaLabel={props.title}
                    items={props.items.map((item, index) => ({ id: `${props.id}-${index}`, title: item }))}
                    empty={<EmptyNotice message={props.title} />}
                />
            )}
            {props.afterItems.map((paragraph) => (
                <Text key={paragraph}>{paragraph}</Text>
            ))}
            {props.limitedUse === null ? null : (
                <>
                    <Text>{props.limitedUse.sentence}</Text>
                    <Text size="sm">
                        <Link kind="external" href={props.limitedUse.policyUrl}>
                            {props.limitedUse.policyUrl}
                        </Link>
                    </Text>
                    {props.limitedUse.note === "" ? null : <Text tone="muted">{props.limitedUse.note}</Text>}
                </>
            )}
        </Stack>
    </Section>
)
