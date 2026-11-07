import Link from 'next/link';
import { Library, Search, Eye } from 'lucide-react';
import { CoreLensLogo } from '@/components/logos/core-lens-logo';

const highlights = [
  {
    icon: Library,
    title: 'Personal research library',
    description: 'Upload PDFs and get page-level citations back.',
  },
  {
    icon: Search,
    title: 'Web & academic search',
    description: 'Grounded answers from live sources, with inline citations.',
  },
  {
    icon: Eye,
    title: 'Automated Lookouts',
    description: 'Track a topic over time and get notified on updates.',
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-svh w-full bg-background">
      <aside className="relative hidden lg:flex lg:w-[46%] xl:w-1/2 h-full flex-col overflow-hidden border-r border-border/60 bg-muted/30">
        {/* Soft brand glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -left-40 size-[32rem] rounded-full bg-primary/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-48 -right-32 size-[28rem] rounded-full bg-primary/10 blur-3xl"
        />

        <div className="relative flex flex-1 flex-col justify-between p-12 xl:p-16">
          <Link href="/" className="flex w-fit items-center gap-2.5">
            <CoreLensLogo className="size-8" />
            <span className="text-lg font-semibold tracking-tight">Core Lens AI</span>
          </Link>

          <div className="max-w-md space-y-10">
            <div className="space-y-3">
              <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground text-balance">
                AI Search that actually understands you
              </h2>
              <p className="text-base text-muted-foreground text-pretty">
                Skip the ads. Get real answers. From the latest AI models.
              </p>
            </div>

            <ul className="space-y-3">
              {highlights.map((highlight) => (
                <li
                  key={highlight.title}
                  className="flex items-start gap-4 rounded-xl border border-border/60 bg-background/50 p-4 backdrop-blur-sm"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <highlight.icon className="size-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">{highlight.title}</p>
                    <p className="text-sm text-muted-foreground">{highlight.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <a href="https://git.new/core-lens" target="_blank" className="transition-colors hover:text-foreground">
              Open Source
            </a>
            <span aria-hidden>•</span>
            <span>Live Search</span>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 md:px-8">
        {/* Logo shown only when the left panel is hidden */}
        <Link href="/" className="mb-10 flex items-center gap-2.5 lg:hidden">
          <CoreLensLogo className="size-8" />
          <span className="text-lg font-semibold tracking-tight">Core Lens AI</span>
        </Link>
        {children}
      </main>
    </div>
  );
}
