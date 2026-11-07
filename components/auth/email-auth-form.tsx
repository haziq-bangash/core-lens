'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Input } from '@/components/ui/input';
import { AuthError, AuthField, authSubmitClass } from './auth-field';
import { CheckInbox } from './check-inbox';
import { PasswordInput } from './password-input';

interface EmailAuthFormProps {
  mode: 'sign-in' | 'sign-up';
}

export function EmailAuthForm({ mode }: EmailAuthFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const isSignUp = mode === 'sign-up';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (isSignUp && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
          callbackURL: '/',
        });

        if (error) {
          setError(error.message ?? 'Could not create your account. Please try again.');
          return;
        }
        // The server responds identically whether or not the address is already registered,
        // so always show the neutral "check your inbox" state.
        setPendingEmail(email.trim());
        return;
      }

      const { error } = await authClient.signIn.email({
        email: email.trim(),
        password,
        callbackURL: '/',
      });

      if (error) {
        if (error.status === 403) {
          // Unverified email: the server already re-sent the link (sendOnSignIn).
          setPendingEmail(email.trim());
          return;
        }
        setError(error.message ?? 'Invalid email or password.');
        return;
      }

      router.replace('/');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (pendingEmail) {
    return (
      <CheckInbox
        email={pendingEmail}
        onBack={() => {
          setPendingEmail(null);
          setPassword('');
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isSignUp && (
        <AuthField id="name" label="Name">
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="h-11 rounded-xl"
          />
        </AuthField>
      )}

      <AuthField id="email" label="Email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-11 rounded-xl"
        />
      </AuthField>

      <AuthField
        id="password"
        label="Password"
        hint={
          !isSignUp && (
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          )
        }
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          required
          minLength={isSignUp ? 8 : undefined}
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isSignUp ? 'At least 8 characters' : 'Your password'}
        />
      </AuthField>

      <AuthError message={error} />

      <button type="submit" disabled={loading} className={authSubmitClass}>
        {loading && <Loader2 className="size-4 animate-spin" />}
        {isSignUp ? 'Create account' : 'Sign in'}
      </button>
    </form>
  );
}
