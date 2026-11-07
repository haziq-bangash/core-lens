import { cn } from '@/lib/utils';

interface AuthShellProps {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Shared card chrome for every auth screen so they stay visually consistent. */
export function AuthShell({ title, description, children, className }: AuthShellProps) {
  return (
    <div className="w-full max-w-[400px] mx-auto">
      <div
        className={cn(
          'space-y-6 rounded-2xl border border-border/60 bg-card/50 p-8 shadow-sm sm:p-10',
          className,
        )}
      >
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground text-pretty">{description}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
