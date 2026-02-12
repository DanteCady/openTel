import type { ReactNode } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { DashboardGuard } from "@/components/dashboard/dashboard-guard";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardGuard>
      <div className="flex h-screen flex-col bg-background">
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-auto p-4">{children}</main>
          </div>
        </div>
      </div>
    </DashboardGuard>
  );
}
