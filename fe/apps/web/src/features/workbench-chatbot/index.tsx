import { ChatbotWorkbench } from "@/features/pages/ChatbotWorkbench"

/** The id of the installation a registry call carries, or null. */
const installationIdOf = (value: unknown): string | null => {
    if (typeof value !== "object" || value === null || !("id" in value)) return null
    return typeof value.id === "string" ? value.id : null
}

/** Legacy entry of the module workbench registry (props: tab, focus, installation); removed with the registry rewrite in wave 3. */
const WorkbenchChatbot = (props: Record<string, unknown>) => (
    <ChatbotWorkbench
        focus={typeof props.focus === "string" ? props.focus : null}
        installationId={installationIdOf(props.installation)}
    />
)

export default WorkbenchChatbot
