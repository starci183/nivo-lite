import { redirect } from "next/navigation";

/** Old entry point: the workspaces area replaced it. */
const OnboardingPage = () => redirect("/workspaces");

export default OnboardingPage;
