import { TeamPage } from "@/features/pages/TeamPage"

export { teamMetadata as generateMetadata } from "@/features/pages/TeamPage"

/** Team: members, roles and invitations. Owner and manager only; staff see a friendly 403. */
const Page = () => <TeamPage />

export default Page
