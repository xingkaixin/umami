'use client';
import { useEffect } from 'react';
import { useApi } from '@/components/hooks';
import { removeClientAuthToken } from '@/lib/client';
import { setUser } from '@/store/app';

export function LogoutPage() {
  const { post } = useApi();

  useEffect(() => {
    async function logout() {
      try {
        await post('/auth/logout');
      } catch {
        // A failed server request must not leave the browser signed in or stuck here.
      } finally {
        removeClientAuthToken();
        setUser(null);
        window.location.href = `${process.env.basePath || ''}/login`;
      }
    }

    void logout();
  }, [post]);

  return null;
}
