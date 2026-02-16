'use client';

import { useState } from 'react';
import { authClient, signIn } from '@/lib/auth-client';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

type AuthProvider = 'github' | 'google' | 'twitter' | 'microsoft';

interface AuthIconProps extends React.ComponentProps<'svg'> {}

/**
 * Authentication provider icons
 */
const AuthIcons = {
  Google: (props: AuthIconProps) => (
    <svg viewBox="0 0 256 262" preserveAspectRatio="xMidYMid" {...props}>
      <path
        d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
        fill="#4285F4"
      />
      <path
        d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
        fill="#34A853"
      />
      <path
        d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782"
        fill="#FBBC05"
      />
      <path
        d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
        fill="#EB4335"
      />
    </svg>
  ),
};

interface SignInButtonProps {
  title: string;
  provider: AuthProvider;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  callbackURL: string;
  icon: React.ReactNode;
}

interface AuthCardProps {
  title: string;
  description: string;
  mode?: 'sign-in' | 'sign-up';
}

/**
 * Button component for social authentication providers
 */
const SignInButton = ({ title, provider, loading, setLoading, callbackURL, icon }: SignInButtonProps) => {
  const lastMethod = authClient.getLastUsedLoginMethod();

  return (
    <button
      className="relative w-full h-12 text-sm font-normal bg-muted/50 hover:bg-muted transition-all duration-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-start px-4 gap-3 group"
      disabled={loading}
      onClick={async () => {
        await signIn.social(
          {
            provider,
            callbackURL,
          },
          {
            onRequest: () => {
              setLoading(true);
            },
          },
        );
      }}
    >
      <div className="w-5 h-5 flex items-center justify-center">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      </div>
      <span className="text-foreground/80 group-hover:text-foreground transition-colors">Sign in with {title}</span>
      {lastMethod === provider && (
        <Badge variant="default" className="absolute -top-2 -right-2 pointer-events-none z-10">
          Last used
        </Badge>
      )}
    </button>
  );
};

/**
 * Authentication component with social provider options
 */
export default function AuthCard({ title, description, mode = 'sign-in' }: AuthCardProps) {
  const [googleLoading, setGoogleLoading] = useState(false);

  return (
    <div className="w-full max-w-[380px] mx-auto">
      <div className="space-y-6">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-medium">{title}</h1>
          <p className="text-sm text-muted-foreground/80">{description}</p>
        </div>

        <div className="space-y-4">
          <SignInButton
            title="Google"
            provider="google"
            loading={googleLoading}
            setLoading={setGoogleLoading}
            callbackURL="/"
            icon={<AuthIcons.Google className="w-4 h-4" />}
          />
        </div>

        <div className="pt-6 space-y-4">
          <p className="text-[11px] text-center text-muted-foreground/60 leading-relaxed">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="hover:text-muted-foreground underline-offset-2 underline">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy-policy" className="hover:text-muted-foreground underline-offset-2 underline">
              Privacy Policy
            </Link>
          </p>

          <p className="text-sm text-center text-muted-foreground">
            {mode === 'sign-in' ? (
              <>
                New to Contract Lens?{' '}
                <Link href="/sign-up" className="text-foreground font-medium hover:underline underline-offset-4">
                  Create account
                </Link>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <Link href="/sign-in" className="text-foreground font-medium hover:underline underline-offset-4">
                  Sign in
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
