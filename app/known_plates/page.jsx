import { getKnownPlatesList } from "@/app/actions";
import { KnownPlatesTable } from "@/components/KnownPlatesTable";
import DashboardLayout from "@/components/layout/MainLayout";
import BasicTitle from "@/components/layout/BasicTitle";

export const dynamic = "force-dynamic";

export default async function KnownPlatesPage() {
  const response = await getKnownPlatesList();
  const knownPlates = response.success ? response.data : [];

  return (
    <DashboardLayout>
      <BasicTitle title="Known Plates">
        <KnownPlatesTable initialData={knownPlates} />
      </BasicTitle>
    </DashboardLayout>
  );
}
