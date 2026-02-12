"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useSession } from "@/context/session-context";
import { useEffect, useState } from "react";

interface EndpointRow {
  id: string;
  tenant_id: string;
  label: string;
  type: string;
  agent_state?: string | null;
}

export default function AgentsPage() {
  const { session } = useSession();
  const [agents, setAgents] = useState<EndpointRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.tenantId || !session?.token) {
      setLoading(false);
      return;
    }
    fetch(`${getApiUrl()}/v1/tenants/${session.tenantId}/endpoints`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAgents(Array.isArray(data) ? data : []))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, [session?.tenantId, session?.token]);

  const stateColor = (s?: string) => {
    switch (s) {
      case "available":
        return "text-emerald-600";
      case "busy":
        return "text-amber-600";
      case "away":
        return "text-zinc-500";
      case "break":
        return "text-blue-600";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-muted-foreground">
          Team members and their current status.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Agents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No agents yet. Create endpoints via the API.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {agents.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="font-medium">{a.label || a.id}</span>
                  <span className={stateColor(a.agent_state ?? undefined)}>
                    {a.agent_state ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
