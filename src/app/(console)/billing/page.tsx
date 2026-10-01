import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/** Old billing URL: the current workspace's billing lives under /workspaces/<id>/billing. */
const BillingPage = async () => redirect(`/workspaces/${(await getSession()).workspace.id}/billing`);

export default BillingPage;
