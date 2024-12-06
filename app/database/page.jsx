import DashboardLayout from "@/components/layout/MainLayout";
import TitleNavbar from "@/components/layout/TitleNav";
import { PlateDbTableWrapper } from "@/components/PlateDbTableWrapper";

export const dynamic = "force-dynamic";

export default async function Database() {
  return (
    <DashboardLayout>
      <TitleNavbar title="Plate Database">
        <PlateDbTableWrapper />
      </TitleNavbar>
    </DashboardLayout>
  );
}
