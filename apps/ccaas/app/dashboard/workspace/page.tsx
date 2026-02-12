"use client";

import { Dialer } from "@/components/workspace/dialer";
import { CallPanel } from "@/components/workspace/call-panel";
import { IncomingCallModal } from "@/components/workspace/incoming-call-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function WorkspacePage() {
  return (
    <>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
          <p className="text-muted-foreground">
            Take and make calls. Set your status to Available to receive queue calls.
          </p>
        </div>

        <div className="flex gap-4">
          <aside className="w-72 shrink-0">
            <Dialer />
            <Card className="mt-4 border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Queue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Queue list can be loaded from API here.
                </p>
              </CardContent>
            </Card>
          </aside>
          <section className="flex flex-1 flex-col items-center justify-center rounded-lg border border-border bg-card/50 p-6">
            <CallPanel />
          </section>
        </div>
      </div>
      <IncomingCallModal />
    </>
  );
}
