"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { SaveResult } from "./api-types";
import type { CleanedSurvey, CleaningResult } from "./survey-cleaner";

/** Where the numbers on screen come from. */
export type Source = { kind: "file"; result: CleaningResult } | { kind: "database" };

export type SessionState =
  | { phase: "idle" }
  | { phase: "uploading"; fileName: string }
  | { phase: "loadingSaved" }
  | { phase: "done"; source: Source; fileName: string; surveys: CleanedSurvey[]; runId: number }
  | { phase: "error"; message: string };

export type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; result: SaveResult }
  | { status: "error"; message: string };

interface SessionValue {
  state: SessionState;
  setState: Dispatch<SetStateAction<SessionState>>;
  save: SaveState;
  setSave: Dispatch<SetStateAction<SaveState>>;
  /** The last cleaned file, sent again when saving. */
  fileRef: { current: File | null };
  runCounter: { current: number };
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Keeps the uploaded file and its analysis alive while the user moves between
 * pages (upload and tickets). It lives in the root layout, which Next.js does
 * not unmount on navigation. A full page reload (F5) clears it.
 */
export function SurveySessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ phase: "idle" });
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const fileRef = useRef<File | null>(null);
  const runCounter = useRef(0);

  return (
    <SessionContext.Provider value={{ state, setState, save, setSave, fileRef, runCounter }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSurveySession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSurveySession must be used inside <SurveySessionProvider>");
  return ctx;
}
