import { redirect } from "next/navigation";
import { Chrome } from "@/features/onboarding/Chrome";
import { NewWorkspaceView } from "@/features/onboarding/NewWorkspaceView";
import { listPlans } from "@/lib/billing";
import { supabaseServer } from "@/lib/supabase/server";

/** Step 1 (plan) and step 2 (name + business type) of opening a paid workspace. */
const NewWorkspacePage = async () => {
  const { data } = await (await supabaseServer()).auth.getUser();
  if (!data.user) redirect("/login");
  return (
    <Chrome>
      <NewWorkspaceView plans={await listPlans()} />
    </Chrome>
  );
};

export default NewWorkspacePage;
