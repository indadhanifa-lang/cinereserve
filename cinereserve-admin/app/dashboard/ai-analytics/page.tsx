import { EmptyState } from "@/components/dashboard/empty-state";
import { EMPTY_STATES } from "@/lib/dashboard-nav";

export default function AiAnalyticsPage() {
  return <EmptyState {...EMPTY_STATES["ai-analytics"]} />;
}
