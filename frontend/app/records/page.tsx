'use client';

import { useEffect, useState, Suspense } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useRouter } from 'next/navigation';
import HealthRecordsVault from '../../components/HealthRecordsVault';

export default function RecordsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (!currentUser) {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-curo-text-dim text-sm">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-curo-accent animate-pulse"></div>
          Loading Health Records Vault…
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center text-curo-text-dim text-sm">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-curo-accent animate-pulse"></div>
          Loading Health Records Vault…
        </div>
      </div>
    }>
      <HealthRecordsVault userId={user.uid} />
    </Suspense>
  );
}
