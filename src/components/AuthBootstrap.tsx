"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth/store";

export function AuthBootstrap() {
  useEffect(() => {
    void useAuth.getState().initialize();
  }, []);
  return null;
}
