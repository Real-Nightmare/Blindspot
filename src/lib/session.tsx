import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";

export type Profile = Doc<"profiles">;

type SessionState = {
  profile: Profile | null;
  isCreator: boolean;
  isAdmin: boolean;
  isApproved: boolean;
  permissions: string[];
};

const SessionCtx = createContext<SessionState | null>(null);

export function SessionProvider({ profile, children }: { profile: Profile | null; children: ReactNode }) {
  const value: SessionState = {
    profile,
    isCreator: profile?.role === "creator" && profile.status === "approved",
    isAdmin:
      (profile?.role === "admin" || profile?.role === "creator") &&
      profile?.status === "approved",
    isApproved: profile?.status === "approved",
    permissions:
      profile?.role === "creator"
        ? ["*"]
        : ((profile as unknown as { permissions?: string[] })?.permissions ?? []),
  };
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

/** Convenience hook: reactive profile of the signed-in user. */
export function useMyProfile(): Profile | null | undefined {
  return useQuery(api.provision.myProfile, {});
}
