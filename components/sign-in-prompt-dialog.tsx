'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { authClient, signIn } from '@/lib/auth-client';
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { EmailAuthForm } from '@/components/auth/email-auth-form';

interface SignInPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SignInButtonProps {
  provider: 'google' | 'microsoft';
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

const SignInButton = ({ provider, loading, setLoading }: SignInButtonProps) => {
  const isGoogle = provider === 'google';
  const isMicrosoft = provider === 'microsoft';
  const lastMethod = authClient.getLastUsedLoginMethod();

  const providerName = isGoogle ? 'Google' : 'Microsoft';

  return (
    <Button
      variant="outline"
      className="relative w-full h-12 rounded-xl px-4 font-medium text-sm"
      disabled={loading}
      onClick={async () => {
        await signIn.social(
          {
            provider,
            callbackURL: '/',
          },
          {
            onRequest: () => {
              setLoading(true);
            },
          },
        );
      }}
    >
      <div className="flex items-center justify-center w-full gap-3">
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span className="text-sm">Signing in...</span>
          </>
        ) : (
          <>
            <div className="shrink-0 w-5 h-5 flex items-center justify-center">
              {isGoogle && (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              {isMicrosoft && (
                <svg className="w-5 h-5" viewBox="0 0 21 21">
                  <path fill="#F35325" d="M0 0h10v10H0z" />
                  <path fill="#81BC06" d="M11 0h10v10H11z" />
                  <path fill="#05A6F0" d="M0 11h10v10H0z" />
                  <path fill="#FFBA08" d="M11 11h10v10H11z" />
                </svg>
              )}
            </div>
            <span className="text-sm font-medium">Continue with {providerName}</span>
            {lastMethod === provider && (
              <Badge variant="default" className="absolute -top-2 -right-2 pointer-events-none z-10">
                Last used
              </Badge>
            )}
          </>
        )}
      </div>
    </Button>
  );
};

function PromptBody({ onClose }: { onClose: () => void }) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');

  return (
    <div className="space-y-5">
      <SignInButton provider="google" loading={googleLoading} setLoading={setGoogleLoading} />

      <div className="flex items-center gap-3" role="separator" aria-label="or">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <EmailAuthForm key={mode} mode={mode} />

      <p className="text-sm text-center text-muted-foreground">
        {mode === 'sign-in' ? 'New to Core Lens?' : 'Already have an account?'}{' '}
        <button
          type="button"
          onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {mode === 'sign-in' ? 'Create account' : 'Sign in'}
        </button>
      </p>

      <div className="space-y-3 border-t border-border pt-4">
        <Button variant="ghost" onClick={onClose} className="w-full h-10 font-normal text-sm">
          Continue without account
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          By continuing, you accept our{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms
          </Link>
          {' & '}
          <Link href="/privacy-policy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}

export function SignInPromptDialog({ open, onOpenChange }: SignInPromptDialogProps) {
  const isMobile = useIsMobile();
  const close = () => onOpenChange(false);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] px-6 pb-6">
          <DrawerHeader className="px-0 pt-4 pb-0 font-be-vietnam-pro">
            <DrawerTitle className="text-lg font-semibold">Sign in to continue</DrawerTitle>
            <p className="text-sm text-muted-foreground pt-1">Save conversations and sync across devices</p>
          </DrawerHeader>
          <div className="overflow-y-auto pt-5">
            <PromptBody onClose={close} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[400px] max-h-[92vh] overflow-y-auto p-8 gap-0"
        // Don't auto-focus the first button: it would show a heavy focus ring as if it were already selected.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="mb-6 space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Sign in to continue</h2>
          <p className="text-sm text-muted-foreground">Save conversations and sync across devices</p>
        </div>
        <PromptBody onClose={close} />
      </DialogContent>
    </Dialog>
  );
}
