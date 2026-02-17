import { Metadata } from 'next';
import dynamic from 'next/dynamic';

const LibraryPage = dynamic(
  () => import('@/components/library/library-page').then((m) => m.LibraryPage),
  {
    ssr: true,
    loading: () => <div style={{ minHeight: 240 }} />,
  },
);

export const metadata: Metadata = {
  title: 'Research Library',
  description: 'Manage your research papers and documents',
};

export default function Library() {
  return <LibraryPage />;
}
