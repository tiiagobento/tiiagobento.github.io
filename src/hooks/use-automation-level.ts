"use client";

import * as React from "react";
import { readAutomationLevel, saveAutomationLevel, type AutomationLevel } from "@/lib/automation-preferences";

export function useAutomationLevel(userId?: string | null) {
  const [level, setLevelState] = React.useState<AutomationLevel>("semi-automatic");

  React.useEffect(() => {
    setLevelState(readAutomationLevel(userId));
    function handleChange(event: Event) {
      const next = (event as CustomEvent<AutomationLevel>).detail;
      if (next) setLevelState(next);
    }
    window.addEventListener("novaforma:automation-level-changed", handleChange);
    return () => window.removeEventListener("novaforma:automation-level-changed", handleChange);
  }, [userId]);

  const setLevel = React.useCallback(
    (next: AutomationLevel) => {
      saveAutomationLevel(next, userId);
      setLevelState(next);
    },
    [userId],
  );

  return [level, setLevel] as const;
}
