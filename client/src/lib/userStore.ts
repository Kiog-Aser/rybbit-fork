import { User } from "better-auth";
import { create } from "zustand";
import { authClient } from "./auth";

export const userStore = create<{
  user: User | null;
  isPending: boolean;
  setSession: (user: User) => void;
  setIsPending: (isPending: boolean) => void;
}>(set => ({
  user: null,
  isPending: true,
  setSession: user => set({ user }),
  setIsPending: isPending => set({ isPending }),
}));

const SESSION_TIMEOUT_MS = 8_000;

Promise.race([
  authClient.getSession(),
  new Promise<{ data: { user: User | null } | null }>(resolve =>
    setTimeout(() => resolve({ data: null }), SESSION_TIMEOUT_MS)
  ),
]).then(({ data: session }) => {
  userStore.setState({
    user: session?.user ?? null,
    isPending: false,
  });
});
