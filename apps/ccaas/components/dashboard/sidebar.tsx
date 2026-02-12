"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Headphones,
  Users,
  ListOrdered,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/workspace", label: "Workspace", icon: Headphones },
  { href: "/dashboard/queues", label: "Queues", icon: ListOrdered },
  { href: "/dashboard/agents", label: "Agents", icon: Users },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
      <Link href="/dashboard" className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Image src="/logo.png" alt="OpenTel" width={28} height={28} className="h-7 w-7 shrink-0" />
        <span className="font-semibold tracking-tight">OpenTel CCaaS</span>
      </Link>
      <nav className="flex flex-col gap-0.5 p-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
