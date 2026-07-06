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
    <div className="flex items-center justify-between h-svh bg-background w-full md:w-auto">
      <div className="hidden lg:flex lg:w-1/2 h-full bg-muted/30 flex-col">
        <div className="flex-1 flex flex-col justify-between p-12">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <CoreLensLogo className="size-8" />
              <span className="text-lg font-medium">Core Lens AI</span>
            </Link>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-semibold text-foreground mb-3">AI Search that actually understands you</h2>
              <p className="text-muted-foreground">Skip the ads. Get real answers. From the latest AI models.</p>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                What you can do
              </h3>

              <ul className="space-y-4">
                {highlights.map((highlight) => (
                  <li key={highlight.title} className="flex items-start gap-3">
                    <highlight.icon className="size-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{highlight.title}</p>
                      <p className="text-xs text-muted-foreground">{highlight.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <a href="https://git.new/core-lens" target="_blank" className="hover:text-foreground transition-colors">
              Open Source
            </a>
            <span>•</span>
            <span>Live Search</span>
          </div>
        </div>
      </div>
      <div className="flex-1 lg:w-1/2 flex items-center justify-center px-4 md:px-8 bg-background">
        {children}
      </div>
    </div>
  );
}
