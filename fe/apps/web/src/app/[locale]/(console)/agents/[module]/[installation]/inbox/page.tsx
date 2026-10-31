import { ChatbotInboxPage } from "@/features/pages/ChatbotInboxPage"

/** The document title of the inbox tab. */
export { chatbotInboxMetadata as generateMetadata } from "@/features/pages/ChatbotInboxPage"

type PageProps = {
    readonly params: Promise<{ module: string; installation: string }>
    readonly searchParams: Promise<{ focus?: string | string[] }>
}

const first = (value: string | string[] | undefined): string | null =>
    (Array.isArray(value) ? (value[0] ?? null) : (value ?? null)) || null

/** The inbox slot of one Chatbot instance: the conversations, the open thread and the customer pane as panes under the tab line. */
const Page = async (props: PageProps) => {
    const [{ module, installation }, query] = await Promise.all([props.params, props.searchParams])
    return <ChatbotInboxPage module={module} installationId={installation} focus={first(query.focus)} />
}

export default Page
