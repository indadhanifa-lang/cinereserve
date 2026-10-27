import { EmptyState } from "@/components/dashboard/empty-state";
import { EMPTY_STATES } from "@/lib/dashboard-nav";

export default function ReportsPage() {
  return <EmptyState {...EMPTY_STATES.reports} />;
}
