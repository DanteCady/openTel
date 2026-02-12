"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/context/session-context";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ArrowRight, Phone, Mail, MessageSquare, Zap } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated } = useSession();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  return !isAuthenticated ? (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200/80 bg-zinc-50/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3">
            <Logo size="md" className="bg-white shadow-sm ring-1 ring-zinc-200/50" />
            <span className="text-lg font-semibold tracking-tight text-zinc-900">
              OpenTel CCaaS
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
            >
              Sign in
            </Link>
            <Link href="/onboarding">
              <Button
                size="sm"
                className="bg-teal-600 font-medium text-white hover:bg-teal-700"
              >
                Get started
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-20 pb-28 text-center md:pt-28 md:pb-36">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl md:text-6xl">
          Contact center, your way
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-600">
          Voice, chat, email, and SMS in one platform. Self-host the open source or use our hosted
          service—no lock-in.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/onboarding">
            <Button
              size="lg"
              className="gap-2 bg-teal-600 font-medium text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700"
            >
              Get started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button
              size="lg"
              variant="outline"
              className="border-zinc-300 font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
            >
              Sign in
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-zinc-200 bg-white py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-900">
            One platform for every channel
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-zinc-600">
            Connect your team and your customers across voice, chat, email, and SMS.
          </p>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Phone,
                title: "Voice",
                desc: "WebRTC and PSTN. Queues, IVR, and agent workspace.",
              },
              {
                icon: MessageSquare,
                title: "Chat",
                desc: "Real-time chat threads and embeddable widget.",
              },
              {
                icon: Mail,
                title: "Email",
                desc: "SendGrid, Mailgun, Gmail, Microsoft 365, or your SMTP.",
              },
              {
                icon: Zap,
                title: "SMS",
                desc: "Twilio and more. Same API, same dashboard.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-6 transition-colors hover:border-teal-200 hover:bg-teal-50/30"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-600 transition-colors group-hover:bg-teal-200">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-zinc-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-200 bg-zinc-50 py-24">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
            Ready to get started?
          </h2>
          <p className="mt-3 text-zinc-600">
            Create your organization and invite your team in minutes.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link href="/onboarding">
              <Button
                size="lg"
                className="bg-teal-600 font-medium text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700"
              >
                Start free
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="border-zinc-300 font-medium text-zinc-700 hover:bg-white hover:text-zinc-900"
              >
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200 bg-white py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-zinc-500">
          OpenTel CCaaS — contact center for voice, chat, email, and SMS.
        </div>
      </footer>
    </div>
  ) : (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Redirecting...</p>
    </div>
  );
}
