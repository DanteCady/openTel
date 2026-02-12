"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, PhoneOff } from "lucide-react";
import { useSession } from "@/context/session-context";

export function IncomingCallModal() {
  const { incomingCall, answerCall, rejectCall } = useSession();

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="mx-4 w-full max-w-sm border-2 border-primary bg-card shadow-xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-3 w-3">
              <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
            </span>
            Incoming call
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            From: {incomingCall.fromEndpointId}
          </p>
        </CardHeader>
        <CardContent className="flex gap-3 pt-4">
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            onClick={answerCall}
          >
            <Phone className="mr-2 h-4 w-4" />
            Answer
          </Button>
          <Button variant="destructive" className="flex-1" onClick={rejectCall}>
            <PhoneOff className="mr-2 h-4 w-4" />
            Decline
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
