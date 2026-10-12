import { redirect } from "next/navigation";

/** Old entry point: everything about "no workspace yet" or "disabled" now lives on /workspaces. */
export default async function NoAccessPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  redirect(`/workspaces?reason=${reason === "disabled" ? "disabled" : "none"}`);
}
