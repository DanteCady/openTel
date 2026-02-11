"use client";

import { useState } from "react";
import {
  Button,
  Input,
  Spinner,
  makeStyles,
} from "@fluentui/react-components";
import {
  Database24Regular,
  Cloud24Regular,
  Storage24Regular,
  Key24Regular,
  PlugConnected24Regular,
  Call24Regular,
  CheckmarkCircle24Filled,
  DismissCircle24Filled,
  ArrowLeft24Regular,
  ArrowRight24Regular,
} from "@fluentui/react-icons";

const useStyles = makeStyles({
  root: {
    position: "relative",
    zIndex: 1,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "48px 24px 64px",
  },
  header: {
    textAlign: "center" as const,
    marginBottom: "48px",
  },
  logo: {
    fontSize: "28px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    background: "linear-gradient(135deg, var(--wizard-text) 0%, var(--wizard-text-muted) 100%)",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    color: "transparent",
    marginBottom: "8px",
  },
  subtitle: {
    fontSize: "14px",
    color: "var(--wizard-text-muted)",
    fontWeight: 500,
  },
  card: {
    width: "100%",
    maxWidth: "560px",
    backgroundColor: "var(--wizard-surface)",
    borderRadius: "var(--wizard-radius)",
    border: "1px solid var(--wizard-border)",
    boxShadow: "var(--wizard-shadow)",
    overflow: "hidden",
  },
  progressBar: {
    height: "3px",
    backgroundColor: "var(--wizard-border)",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "var(--wizard-accent)",
    transition: "width var(--wizard-transition)",
  },
  stepBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "24px 32px",
    borderBottom: "1px solid var(--wizard-border)",
    backgroundColor: "var(--wizard-surface-elevated)",
  },
  stepItem: {
    display: "flex",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  stepConnector: {
    flex: "1 1 24px",
    height: "2px",
    margin: "0 8px",
    borderRadius: "1px",
    backgroundColor: "var(--wizard-border)",
    transition: "background-color var(--wizard-transition)",
  },
  stepDot: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    flexShrink: 0,
    border: "2px solid var(--wizard-border)",
    color: "var(--wizard-text-muted)",
    transition: "all var(--wizard-transition)",
  },
  stepLabel: {
    display: "none",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--wizard-text-muted)",
    marginTop: "6px",
  },
  content: {
    padding: "40px 32px",
  },
  stepTitle: {
    fontSize: "20px",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    marginBottom: "8px",
    color: "var(--wizard-text)",
  },
  stepDescription: {
    fontSize: "14px",
    color: "var(--wizard-text-muted)",
    marginBottom: "24px",
    lineHeight: 1.5,
  },
  fieldGroup: {
    marginBottom: "24px",
  },
  fieldLabel: {
    display: "block",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--wizard-text-muted)",
    marginBottom: "8px",
  },
  actions: {
    display: "flex",
    gap: "12px",
    justifyContent: "space-between",
    marginTop: "32px",
    paddingTop: "24px",
    borderTop: "1px solid var(--wizard-border)",
  },
  progressText: {
    fontSize: "12px",
    color: "var(--wizard-text-muted)",
    alignSelf: "center",
  },
});

const STEPS = [
  {
    id: "database",
    label: "Database",
    shortLabel: "DB",
    description: "PostgreSQL connection string for OpenTel data.",
    placeholder: "postgresql://user:pass@localhost:5432/opentel",
    icon: Database24Regular,
  },
  {
    id: "redis",
    label: "Redis",
    shortLabel: "Redis",
    description: "Redis URL for session and presence storage.",
    placeholder: "redis://localhost:6379",
    icon: Storage24Regular,
  },
  {
    id: "nats",
    label: "NATS",
    shortLabel: "NATS",
    description: "NATS messaging server for event streaming.",
    placeholder: "nats://localhost:4222",
    icon: Cloud24Regular,
  },
  {
    id: "jwt",
    label: "JWT Secret",
    shortLabel: "JWT",
    description: "Secret key for signing authentication tokens.",
    placeholder: "Generate or paste a secure secret",
    icon: Key24Regular,
  },
  {
    id: "turn",
    label: "TURN/STUN",
    shortLabel: "TURN",
    description: "WebRTC TURN/STUN servers for NAT traversal.",
    placeholder: "stun:localhost:3478",
    icon: PlugConnected24Regular,
  },
  {
    id: "sip",
    label: "SIP/SBC (Phase 2)",
    shortLabel: "SIP",
    description: "Optional. Media gateway (FreeSWITCH/Asterisk) and SIP trunk for PSTN. Leave blank for WebRTC-only.",
    placeholder: "",
    icon: Call24Regular,
    phase2: true,
  },
];

export default function ConfigWizardPage() {
  const styles = useStyles();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const currentStep = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  const handleNext = async () => {
    if (isLastStep) {
      return;
    }
    setCompletedSteps((prev) => new Set([...prev, step]));
    setTestResult(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setTestResult(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const handleStepClick = (i: number) => {
    const canJump = completedSteps.has(i) || i < step;
    if (canJump) {
      setTestResult(null);
      setStep(i);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    await new Promise((r) => setTimeout(r, 800));
    // Simulate: pass if value looks reasonable (real validation will call API)
    const val = (values[currentStep.id] ?? "").trim();
    const passed =
      (currentStep.id === "database" && (val.includes("postgres") || val.length > 10)) ||
      (currentStep.id === "redis" && (val.includes("redis") || val.length > 8)) ||
      (currentStep.id === "nats" && (val.includes("nats") || val.length > 8)) ||
      (currentStep.id === "jwt" && val.length >= 16) ||
      (currentStep.id === "turn" && (val.includes("stun") || val.includes("turn") || val.length > 5));
    setTestResult(passed ? "success" : "error");
    setTesting(false);
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <img src="/logo.png" alt="OpenTel" width={80} height={80} style={{ marginBottom: 12 }} />
        <h1 className={styles.logo}>OpenTel</h1>
        <p className={styles.subtitle}>Configuration Wizard</p>
      </header>

      <div className={styles.card}>
        {/* Progress bar */}
        <div className={styles.progressBar}>
          <div
            className={styles.progressBarFill}
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        {/* Step bar */}
        <div className={styles.stepBar}>
          {STEPS.map((s, i) => {
            const StepIcon = s.icon;
            const isActive = i === step;
            const isComplete = completedSteps.has(i) || i < step;
            const isLast = i === STEPS.length - 1;

            const canClick = isComplete && !isActive;

            return (
              <div key={s.id} className={styles.stepItem} style={{ flex: isLast ? "0 0 auto" : "1 1 0" }}>
                <div
                  role={canClick ? "button" : undefined}
                  tabIndex={canClick ? 0 : undefined}
                  onKeyDown={canClick ? (e) => e.key === "Enter" && handleStepClick(i) : undefined}
                  onClick={canClick ? () => handleStepClick(i) : undefined}
                  className={`${styles.stepDot} wizard-step-dot ${isActive ? "wizard-step-dot-active" : ""} ${isComplete ? "wizard-step-dot-complete" : ""} ${canClick ? "clickable" : ""}`}
                >
                  {isComplete && !isActive ? (
                    <CheckmarkCircle24Filled style={{ width: 20, height: 20 }} />
                  ) : (
                    <StepIcon style={{ width: 18, height: 18 }} />
                  )}
                </div>
                {!isLast && (
                <div
                  className={`${styles.stepConnector} ${isComplete ? "wizard-step-connector-active" : ""}`}
                />
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div key={step} className={`${styles.content} wizard-content-enter`}>
          <h2 className={styles.stepTitle}>{currentStep.label}</h2>
          <p className={styles.stepDescription}>{currentStep.description}</p>

          {currentStep.id === "sip" ? (
            <>
              <p style={{ fontSize: 12, color: "var(--wizard-text-muted)", marginBottom: 16 }}>
                See <strong>docs/PHASE2_PSTN.md</strong> in the repo for architecture and env vars. These are optional; save to .env when ready.
              </p>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Gateway URL (FreeSWITCH/Asterisk control)</label>
                <Input
                  placeholder="e.g. http://gateway:8021 (ESL) or gateway:5038 (AMI)"
                  value={values.sip_gateway_url ?? ""}
                  onChange={(_, d) => setValues((v) => ({ ...v, sip_gateway_url: d.value }))}
                  appearance="filled-darker"
                  style={{
                    backgroundColor: "var(--wizard-surface-elevated)",
                    border: "1px solid var(--wizard-border)",
                    borderRadius: "var(--wizard-radius-sm)",
                    color: "var(--wizard-text)",
                    minHeight: 44,
                  }}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>SIP trunk / SBC host (optional)</label>
                <Input
                  placeholder="e.g. sbc.example.com"
                  value={values.sip_trunk_host ?? ""}
                  onChange={(_, d) => setValues((v) => ({ ...v, sip_trunk_host: d.value }))}
                  appearance="filled-darker"
                  style={{
                    backgroundColor: "var(--wizard-surface-elevated)",
                    border: "1px solid var(--wizard-border)",
                    borderRadius: "var(--wizard-radius-sm)",
                    color: "var(--wizard-text)",
                    minHeight: 44,
                  }}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>SIP port (optional)</label>
                <Input
                  placeholder="5060"
                  value={values.sip_trunk_port ?? ""}
                  onChange={(_, d) => setValues((v) => ({ ...v, sip_trunk_port: d.value }))}
                  appearance="filled-darker"
                  style={{
                    backgroundColor: "var(--wizard-surface-elevated)",
                    border: "1px solid var(--wizard-border)",
                    borderRadius: "var(--wizard-radius-sm)",
                    color: "var(--wizard-text)",
                    minHeight: 44,
                  }}
                />
              </div>
            </>
          ) : (
          <div className={`${styles.fieldGroup} wizard-input`}>
            <label className={styles.fieldLabel}>{currentStep.label}</label>
            <Input
              placeholder={currentStep.placeholder}
              value={values[currentStep.id] ?? ""}
              onChange={(_, d) => {
                setValues((v) => ({ ...v, [currentStep.id]: d.value }));
                setTestResult(null);
              }}
              appearance="filled-darker"
              style={{
                backgroundColor: "var(--wizard-surface-elevated)",
                border: "1px solid var(--wizard-border)",
                borderRadius: "var(--wizard-radius-sm)",
                color: "var(--wizard-text)",
                minHeight: 44,
              }}
            />
          </div>
          )}

          {currentStep.id !== "sip" && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Button
                appearance="outline"
                onClick={handleTest}
                disabled={testing}
                icon={testing ? <Spinner size="tiny" /> : undefined}
                style={{
                  borderColor: "var(--wizard-border)",
                  color: "var(--wizard-text-muted)",
                }}
              >
                {testing ? "Testing..." : "Test Connection"}
              </Button>
              {testResult === "success" && (
                <span className="wizard-test-success">
                  <CheckmarkCircle24Filled style={{ width: 18, height: 18 }} />
                  Connection successful
                </span>
              )}
              {testResult === "error" && (
                <span className="wizard-test-error">
                  <DismissCircle24Filled style={{ width: 18, height: 18 }} />
                  Connection failed
                </span>
              )}
            </div>
          )}

          <div className={styles.actions}>
            <Button
              appearance="subtle"
              onClick={handleBack}
              disabled={step === 0}
              icon={<ArrowLeft24Regular />}
              style={{ color: "var(--wizard-text-muted)" }}
            >
              Back
            </Button>
            <span className={styles.progressText}>
              Step {step + 1} of {STEPS.length}
            </span>
            <Button
              appearance="primary"
              onClick={handleNext}
              icon={isLastStep ? undefined : <ArrowRight24Regular />}
              iconPosition={isLastStep ? undefined : "after"}
              style={{
                backgroundColor: "var(--wizard-accent)",
                color: "var(--wizard-bg)",
                borderRadius: "var(--wizard-radius-sm)",
                minWidth: 100,
              }}
            >
              {isLastStep ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
