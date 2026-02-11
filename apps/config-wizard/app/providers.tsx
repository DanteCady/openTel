"use client";

import React from "react";
import { FluentProvider, webDarkTheme } from "@fluentui/react-components";

export function Providers({ children }: { children: React.ReactNode }) {
  return <FluentProvider theme={webDarkTheme}>{children}</FluentProvider>;
}
