"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Phone, UserCircle, Hash } from "lucide-react";
import { useSession } from "@/context/session-context";
import { toast } from "sonner";

export function Dialer() {
  const { dial, connectionStatus } = useSession();
  const [targetType, setTargetType] = useState<"endpoint" | "queue">("endpoint");
  const [targetId, setTargetId] = useState("");

  const handleDial = () => {
    if (connectionStatus !== "connected") {
      toast.error("Connect first");
      return;
    }
    const id = targetId.trim();
    if (!id) {
      toast.error("Enter target ID");
      return;
    }
    dial(targetType, id);
    toast.success("Dialing…");
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Phone className="h-4 w-4" />
          Quick dial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button
            variant={targetType === "endpoint" ? "default" : "outline"}
            size="sm"
            onClick={() => setTargetType("endpoint")}
            className="flex-1"
          >
            <UserCircle className="mr-1 h-3.5 w-3.5" />
            Agent
          </Button>
          <Button
            variant={targetType === "queue" ? "default" : "outline"}
            size="sm"
            onClick={() => setTargetType("queue")}
            className="flex-1"
          >
            <Hash className="mr-1 h-3.5 w-3.5" />
            Queue
          </Button>
        </div>
        <Input
          placeholder={targetType === "queue" ? "Queue ID" : "Endpoint ID"}
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="bg-background text-sm"
        />
        <Button
          onClick={handleDial}
          className="w-full"
          size="sm"
          disabled={connectionStatus !== "connected"}
        >
          <Phone className="mr-2 h-4 w-4" />
          Dial
        </Button>
      </CardContent>
    </Card>
  );
}
