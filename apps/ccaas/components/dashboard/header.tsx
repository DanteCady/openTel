"use client";

import { Button } from "@/components/ui/button";
import { useSession, STATE_LABELS } from "@/context/session-context";
import { User, LogOut, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function Header() {
  const {
    session,
    connectionStatus,
    agentState,
    setAgentState,
    disconnect,
  } = useSession();
  const router = useRouter();

  const handleSignOut = () => {
    disconnect();
    router.push("/login");
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              connectionStatus === "connected" && "bg-emerald-500",
              connectionStatus === "error" && "bg-destructive",
              connectionStatus === "connecting" && "bg-amber-500 animate-pulse"
            )}
          />
          {connectionStatus === "connected"
            ? "Connected"
            : connectionStatus === "connecting"
              ? "Connecting…"
              : connectionStatus === "error"
                ? "Disconnected"
                : "Not connected"}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {session && (
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            {session.endpointId.slice(0, 8)}…
          </div>
        )}
        <div className="flex gap-1 rounded-lg bg-muted/60 p-1">
          {(["available", "busy", "away", "break"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setAgentState(s)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                agentState === s
                  ? s === "available"
                    ? "bg-emerald-600 text-white"
                    : s === "busy"
                      ? "bg-amber-600 text-white"
                      : s === "away"
                        ? "bg-zinc-500 text-white"
                        : "bg-blue-600 text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {STATE_LABELS[s]}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/settings")}
          title="Settings"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
