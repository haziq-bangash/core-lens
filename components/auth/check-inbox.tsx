'use client';

import { useEffect, useState } from 'react';
import { MailCheck } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { AuthError } from './auth-field';

const RESEND_COOLDOWN_SECONDS = 60;

interface CheckInboxProps {
  email: string;
  onBack: () => void;
}

/** Shown after sign-up, or when an unverified user tries to sign in. */
export function CheckInbox({ email, onBack }: CheckInboxProps) {
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    setSending(true);
    setError(null);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: '/' });
    setSending(false);

    if (error) {
      setError(error.message ?? 'Could not resend the email. Please try again.');
      return;
    }
    setResent(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <MailCheck className="size-6" />
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          We sent a verification link to <span className="font-medium text-foreground">{email}</span>. Open it to
          activate your account.
        </p>
        <p className="text-xs text-muted-foreground">
          Can&apos;t find it? Check your spam folder. If you already have an account, try signing in instead.
        </p>
      </div>

      <AuthError message={error} />
      {resent && !error && <p className="text-sm text-muted-foreground">Verification email sent again.</p>}

      <div className="space-y-2">
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0 || sending}
          className="w-full h-11 rounded-xl border border-border bg-background text-sm font-medium transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? 'Sending…' : cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend email'}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full h-9 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Use a different email
        </button>
      </div>
    </div>
  );
}
