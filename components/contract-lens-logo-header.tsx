import { CoreLensLogo } from "./logos/core-lens-logo"; 

export const CoreLensLogoHeader = () => (
  <div className="flex items-center gap-2 my-1.5">
    <CoreLensLogo className="size-6.5" />
    <h2 className="text-xl font-normal font-be-vietnam-pro text-foreground dark:text-foreground">Core Lens</h2>
  </div>
);
