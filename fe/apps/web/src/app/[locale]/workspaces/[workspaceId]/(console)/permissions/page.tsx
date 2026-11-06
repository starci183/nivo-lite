import { PermissionsPage } from "@/features/pages/PermissionsPage"

export { permissionsMetadata as generateMetadata } from "@/features/pages/PermissionsPage"

/** Permissions: what each agent may do alone, whom it asks and how they decide. Owner and manager only. */
const Page = () => <PermissionsPage />

export default Page
