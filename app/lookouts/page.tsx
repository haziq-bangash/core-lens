import { Metadata } from 'next';
import dynamic from 'next/dynamic';

const LookoutsPage = dynamic(() => import('@/components/lookouts/lookouts-page').then((m) => m.LookoutsPage), {
  ssr: true,
  loading: () => <div style={{ minHeight: 240 }} />,
});

export const metadata: Metadata = {
  title: 'Lookouts',
  description: 'Get emailed when new papers appear on topics you follow',
};

export default function Lookouts() {
  return <LookoutsPage />;
}
