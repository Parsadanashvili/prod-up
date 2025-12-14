import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SummaryView } from '@/components/summary/summary-view';

export default async function SummaryPage() {
  const user = await getCurrentUser();
  
  if (!user?.id) {
    redirect('/auth/signin');
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Weekly Summary</h1>
      <SummaryView userId={user.id} />
    </div>
  );
}

