import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TasksPageClient } from "@/components/tasks/tasks-page-client";
import { getWeeksByUserId } from "@/lib/db/queries";

export default async function TasksPage() {
  const user = await getCurrentUser();

  if (!user?.id) {
    redirect("/auth/signin");
  }

  const weeks = await getWeeksByUserId(user.id);

  console.log(weeks);

  return <TasksPageClient userId={user.id} weeks={weeks} />;
}
