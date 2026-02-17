import { Metadata } from 'next';
import dynamic from 'next/dynamic';

const PaperDetailPage = dynamic(
  () => import('@/components/library/paper-detail-page').then((m) => m.PaperDetailPage),
  {
    ssr: true,
    loading: () => <div style={{ minHeight: 240 }} />,
  },
);

export const metadata: Metadata = {
  title: 'Paper Details',
  description: 'View and manage your research paper',
};

export default async function PaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaperDetailPage paperId={id} />;
}
