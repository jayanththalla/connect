'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to chat, which will handle auth check
    router.push('/chat');
  }, [router]);

  return null;
}
