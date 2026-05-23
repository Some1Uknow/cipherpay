import { redirect } from "next/navigation";

import { getAuthenticatedSession } from "@/lib/auth/server";

export default async function ConnectWalletPage() {
  const session = await getAuthenticatedSession();
  if (session) {
    redirect("/pay");
  }

  redirect("/?signin=1&next=/pay");
}
