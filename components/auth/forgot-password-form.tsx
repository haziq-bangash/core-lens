'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, MailCheck } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Input } from '@/components/ui/input';
import { AuthError, AuthField, authSubmitClass } from './auth-field';
import { AuthShell } from './auth-shell';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: '/reset-password',
    });
    setLoading(false);

    if (error) {
      setError(error.message ?? 'Could not send the reset email. Please try again.');
      return;
    }
    // Same response whether or not the account exists, to avoid leaking which emails are registered.
    setSent(true);
  };

  return (
    <AuthShell
      title="Reset your password"
      description={sent ? undefined : "Enter your email and we'll send you a link to reset your password."}
    >
      {sent ? (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{email.trim()}</span>, a reset
            link is on its way. It expires in 1 hour.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField id="email" label="Email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-11 rounded-xl"
            />
          </AuthField>
          <AuthError message={error} />
          <button type="submit" disabled={loading} className={authSubmitClass}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Send reset link
          </button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
