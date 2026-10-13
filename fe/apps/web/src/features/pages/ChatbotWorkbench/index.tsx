import { ChatbotWorkbenchBase } from "./component"

/** The instance id the module registry hands over, either directly or inside its installation record. */
const installationIdOf = (props: Record<string, unknown>): string | undefined => {
    if (typeof props.installationId === "string") return props.installationId
    const installation = props.installation
    if (typeof installation !== "object" || installation === null || !("id" in installation)) return undefined
    return typeof installation.id === "string" ? installation.id : undefined
}

/** The module registry supplies its installation and focus; the browser loads the selected workspace's workbench. */
export const ChatbotWorkbench = (props: Record<string, unknown>) => (
    <ChatbotWorkbenchBase
        props={{
            installationId: installationIdOf(props),
            focus: typeof props.focus === "string" ? props.focus : null,
        }}
    />
)
