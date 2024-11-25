import { Suspense } from "react";
import DashboardLayout from "@/components/layout/MainLayout";
import DashboardMetrics from "./DashboardMetrics";

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-8 p-8">
        <h1 className="text-3xl font-bold mb-6">License Plate Dashboard (DEV)</h1>
        <Suspense fallback={<div>Loading dashboard metrics...</div>}>
          <DashboardMetrics />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
