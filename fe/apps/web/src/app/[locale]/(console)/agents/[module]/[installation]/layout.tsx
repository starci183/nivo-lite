import type { ReactNode } from "react"
import { AgentInstanceLayout } from "@/features/layouts/AgentInstanceLayout"

type LayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ module: string; installation: string }>
}

/** The frame slot of one agent instance. */
const Layout = async (props: LayoutProps) => {
    const { module, installation } = await props.params
    return <AgentInstanceLayout module={module} installationId={installation}>{props.children}</AgentInstanceLayout>
}

export default Layout
