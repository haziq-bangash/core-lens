import { ContractLensLogo } from './logos/contract-lens-logo';

export const ContractLensLogoHeader = () => (
  <div className="flex items-center gap-2 my-1.5">
    <ContractLensLogo className="size-6.5" />
    <h2 className="text-xl font-normal font-be-vietnam-pro text-foreground dark:text-foreground">Contract Lens</h2>
  </div>
);
