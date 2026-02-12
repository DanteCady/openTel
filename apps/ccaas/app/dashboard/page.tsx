"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Headphones,
  ListOrdered,
  Users,
  Settings,
  ArrowRight,
} from "lucide-react";
import { useSession } from "@/context/session-context";

const links = [
  { href: "/dashboard/workspace", label: "Agent workspace", icon: Headphones, description: "Take and make calls" },
  { href: "/dashboard/queues", label: "Queues", icon: ListOrdered, description: "View and manage call queues" },
  { href: "/dashboard/agents", label: "Agents", icon: Users, description: "Team status and availability" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, description: "Channels and configuration" },
];

export default function DashboardPage() {
  const { session, connectionStatus } = useSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to OpenTel CCaaS. Choose an area below or go straight to the workspace to take calls.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {links.map(({ href, label, icon: Icon, description }) => (
          <Link key={href} href={href}>
            <Card className="h-full border-border bg-card transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <Icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{description}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Open <ArrowRight className="h-4 w-4" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Status:{" "}
            <span
              className={
                connectionStatus === "connected"
                  ? "text-emerald-600"
                  : connectionStatus === "error"
                    ? "text-destructive"
                    : ""
              }
            >
              {connectionStatus === "connected"
                ? "Connected"
                : connectionStatus === "connecting"
                  ? "Connecting…"
                  : connectionStatus === "error"
                    ? "Disconnected"
                    : "Not connected"}
            </span>
          </p>
          {session && (
            <p className="text-xs text-muted-foreground">
              Endpoint: {session.endpointId.slice(0, 8)}…
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
