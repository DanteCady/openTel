"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/context/session-context";
import { PhoneOff, Headphones, PhoneCall } from "lucide-react";

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CallPanel() {
  const { activeCall, hangUp } = useSession();
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!activeCall) {
      setDuration(0);
      return;
    }
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - activeCall.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCall]);

  if (activeCall) {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-3 rounded-full bg-muted px-4 py-2">
          <PhoneCall className="h-5 w-5 text-primary" />
          <span className="text-2xl font-mono tabular-nums text-foreground">
            {formatDuration(duration)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Active call</p>
        <Button variant="destructive" size="lg" onClick={hangUp}>
          <PhoneOff className="mr-2 h-5 w-5" />
          End call
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="rounded-full bg-muted p-4">
        <Headphones className="h-12 w-12 text-muted-foreground" />
      </div>
      <p className="text-lg font-medium">Ready to take calls</p>
      <p className="text-sm text-muted-foreground">
        Set status to Available and wait for incoming calls, or use the dialer.
      </p>
    </div>
  );
}
