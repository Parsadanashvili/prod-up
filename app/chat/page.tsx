import { ChatInterface } from "@/components/chat/chat-interface";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ChatPage() {
  const user = await getCurrentUser();

  if (!user?.id) {
    redirect("/auth/signin");
  }

  return (
    <div className="container mx-auto p-4 h-[calc(100vh-64px)] flex flex-col max-w-3xl">
      <div className="flex-1 min-h-0">
        <ChatInterface userId={user.id} />
      </div>
    </div>
  );
}
