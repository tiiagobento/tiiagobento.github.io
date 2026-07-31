import { EstimateDetail } from "@/components/steel-frame/estimate-detail";

export default async function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EstimateDetail estimateId={id} />;
}
