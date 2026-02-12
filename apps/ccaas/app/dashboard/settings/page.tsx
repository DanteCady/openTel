"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/context/session-context";
import { Mail, MessageSquare, Phone, Settings2 } from "lucide-react";

export default function SettingsPage() {
  const { session } = useSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Organization and channel configuration. Use the API to configure email, SMS, and voice.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4" />
            Session
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {session && (
            <>
              <p>
                <span className="text-muted-foreground">Tenant:</span>{" "}
                {session.tenantId || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Endpoint:</span>{" "}
                {session.endpointId}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Channels</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Configure voice, email, SMS, and chat via the OpenTel API (PATCH /channels/*).
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              Voice — WebRTC / PSTN via signaling and gateway
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email — SendGrid, Mailgun, Gmail, Microsoft 365, or custom SMTP
            </li>
            <li className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              SMS — Twilio
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
