import { getPlateReads } from "@/lib/db";
import PlateTable from "@/components/PlateTable";
import { ThemeToggle } from "@/components/ThemeToggle";
import DashboardLayout from "@/components/layout/MainLayout";
import { redirect } from "next/navigation";
import { withBasePath } from "@/lib/utils";

export default async function Home() {
  redirect(withBasePath("/dashboard"));
}
