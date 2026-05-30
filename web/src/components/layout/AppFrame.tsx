"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";

const WORKSPACE_PATHS = [
  "/dashboard",
  "/invoices",
  "/imports",
  "/recipients",
  "/batches",
  "/reports",
  "/settings",
  "/pay",
  "/bulk-pay",
  "/agent-pay",
  "/history",
];

function isWorkspaceRoute(pathname: string) {
  return WORKSPACE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (!isWorkspaceRoute(pathname)) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
