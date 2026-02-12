"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListOrdered } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useSession } from "@/context/session-context";
import { useEffect, useState } from "react";

interface QueueRow {
  id: string;
  name: string;
  tenantId: string;
}

export default function QueuesPage() {
  const { session } = useSession();
  const [queues, setQueues] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.tenantId || !session?.token) {
      setLoading(false);
      return;
    }
    fetch(`${getApiUrl()}/v1/tenants/${session.tenantId}/queues`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setQueues(list.map((q: { id: string; name?: string; tenantId?: string }) => ({
          id: q.id,
          name: q.name ?? q.id,
          tenantId: q.tenantId ?? "",
        })));
      })
      .catch(() => setQueues([]))
      .finally(() => setLoading(false));
  }, [session?.tenantId, session?.token]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Queues</h1>
        <p className="text-muted-foreground">
          Call queues for routing inbound and outbound calls.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListOrdered className="h-4 w-4" />
            Queues
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : queues.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No queues yet. Create queues via the API or configure your contact center.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {queues.map((q) => (
                <li
                  key={q.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="font-medium">{q.name ?? q.id}</span>
                  <span className="text-muted-foreground">{q.id.slice(0, 8)}…</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
