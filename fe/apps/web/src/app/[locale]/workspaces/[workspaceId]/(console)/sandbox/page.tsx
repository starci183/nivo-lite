import { SandboxPage } from "@/features/pages/SandboxPage"

export { sandboxMetadata as generateMetadata } from "@/features/pages/SandboxPage"

/** Sandbox: trial accounts of the dev environment. Owner and manager only; production shows one notice. */
const Page = () => <SandboxPage />

export default Page
