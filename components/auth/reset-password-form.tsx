'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { AuthError, AuthField, authSubmitClass } from './auth-field';
import { AuthShell } from './auth-shell';
import { PasswordInput } from './password-input';

function BackToSignIn() {
  return (
    <p className="text-center text-sm text-muted-foreground">
      <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
        Back to sign in
      </Link>
    </p>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const invalidLink = !token || params.get('error') === 'INVALID_TOKEN';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!token) return;

    setLoading(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);

    if (error) {
      setError(error.message ?? 'Could not reset your password. The link may have expired.');
      return;
    }

    toast.success('Password updated. Please sign in.');
    router.replace('/sign-in');
  };

  if (invalidLink) {
    return (
      <AuthShell title="Link expired" description="This password reset link is invalid or has expired.">
        <Link href="/forgot-password" className={authSubmitClass}>
          Request a new link
        </Link>
        <BackToSignIn />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" description="Make it at least 8 characters.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField id="password" label="New password">
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </AuthField>
        <AuthField id="confirm" label="Confirm password">
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            required
            maxLength={128}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </AuthField>
        <AuthError message={error} />
        <button type="submit" disabled={loading} className={authSubmitClass}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          Update password
        </button>
      </form>
      <BackToSignIn />
    </AuthShell>
  );
}
