import { getPlateReads } from "@/lib/db";
import PlateTable from "@/components/PlateTable";
import { ThemeToggle } from "@/components/ThemeToggle";
import DashboardLayout from "@/components/layout/MainLayout";
import { redirect } from "next/navigation";
import { getBasePath } from '@/lib/serverUtils';

export default async function Home() {
  const basePath = await getBasePath();
  redirect(`${basePath}/dashboard`);
}