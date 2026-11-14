import { SlotView, type SlotLabels } from "@nivo-lite/agent-sdk/client"
import { Section, Stack, SurfaceCard } from "@starci/grammar/common"
import { ContactBlockNode } from "@/components/leaves/ContactBlockNode"
import type { ContactModuleAgentView, ContactsPanesCopy, DataSlot } from "@/modules/types"

/** The words the card draws. */
type ModulesCopy = Pick<ContactsPanesCopy, "modulesTitle" | "modulesNote" | "modulesMore" | "errorBody">

/** What the modules card draws. */
interface ContactModulesCardProps {
    readonly copy: ModulesCopy
    /** What each installed agent's module knows about the person: loading, failed, nothing mounted, or the agents. */
    readonly modules: DataSlot<ReadonlyArray<ContactModuleAgentView>>
    readonly labels: SlotLabels
    readonly onRetry: () => void
}

/** The agents while they are read: one agent with one block, so the card keeps its ready box. */
const PLACEHOLDER: ReadonlyArray<ContactModuleAgentView> = [
    {
        installationId: "installation:placeholder",
        moduleKey: "placeholder",
        name: " ",
        count: 1,
        hasMore: false,
        blocks: [{ id: "block:placeholder", title: " ", nodeJson: "{}", dataJson: "{}", count: 1 }],
    },
]

/** One block a module mounted, named by its agent and the block's own title ("Sales - lead"). */
interface ModuleSection {
    readonly key: string
    readonly title: string
    readonly agent: ContactModuleAgentView
    readonly block: ContactModuleAgentView["blocks"][number]
}

/** Every block of every agent as one flat list of sections, in the order the agents came. */
const sectionsOf = (agents: ReadonlyArray<ContactModuleAgentView>): ReadonlyArray<ModuleSection> =>
    agents.flatMap((agent) =>
        agent.blocks.map((block) => ({
            key: `${agent.installationId}:${block.id}`,
            title: block.title.trim() === "" ? agent.name : `${agent.name} · ${block.title}`,
            agent,
            block,
        })),
    )

/** The section a titled block is drawn for, and whether it is still loading. */
interface SectionViewProps {
    readonly section: ModuleSection
    readonly isLoading: boolean
}

/** One titled section: the name of the block, then the block its module mounted, drawn by the block host. */
const SectionView = (props: SectionViewProps) => (
    <Section title={props.section.title} headingLevel={3} isLoading={props.isLoading}>
        <ContactBlockNode
            moduleKey={props.section.agent.moduleKey}
            installationId={props.section.agent.installationId}
            nodeJson={props.section.block.nodeJson}
            dataJson={props.section.block.dataJson}
            isLoading={props.isLoading}
        />
    </Section>
)

/**
 * The place where installed modules mount their own blocks about this person: ONE card (the engine page draws no business of its own)
 * holding each module's block as a titled section, the sections one row step apart. Nothing is drawn when no module mounts a block.
 */
export const ContactModulesCard = (props: ContactModulesCardProps) => (
    <SlotView
        slot={props.modules}
        placeholder={PLACEHOLDER}
        labels={props.labels}
        errorLayout="band"
        errorDescription={props.copy.errorBody}
        onRetry={props.onRetry}
        forbidden="hide"
        empty="collapse"
        frame={(notice) => (
            <SurfaceCard label={props.copy.modulesTitle} headingLevel={2} fact={props.copy.modulesNote}>
                {notice}
            </SurfaceCard>
        )}
        render={(agents, isSkeleton) => (
            <SurfaceCard
                label={props.copy.modulesTitle}
                headingLevel={2}
                fact={props.copy.modulesNote}
                isLoading={isSkeleton}
                {...(agents.some((agent) => agent.hasMore) ? { note: props.copy.modulesMore } : {})}
            >
                <Stack gap="section">
                    {sectionsOf(agents).map((section) => (
                        <SectionView key={section.key} section={section} isLoading={isSkeleton} />
                    ))}
                </Stack>
            </SurfaceCard>
        )}
    />
)
