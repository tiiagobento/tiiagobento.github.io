import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { getVisibleNavigationItems, navigationItems } from "@/components/app-navigation";

const routerMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => routerMocks,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/offline/db", () => ({
  clearOfflineDbForUser: vi.fn(async () => undefined),
  getOfflineDb: vi.fn(() => null),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: supabaseMocks.getUser,
      getSession: supabaseMocks.getSession,
      signOut: supabaseMocks.signOut,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: supabaseMocks.maybeSingle,
        }),
      }),
    }),
  },
}));

describe("app navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    supabaseMocks.getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } }, error: null });
    supabaseMocks.maybeSingle.mockResolvedValue({ data: { role: "admin" }, error: null });
    supabaseMocks.signOut.mockResolvedValue({ error: null });
  });

  it("keeps the main desktop routes and logout visible", async () => {
    render(<AppSidebar />);

    for (const item of navigationItems) {
      expect(await screen.findByRole("link", { name: item.label })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("opens mobile menu with the same main routes and logs out", async () => {
    render(<AppHeader />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));

    expect(await screen.findByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Novo lead" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Importar com IA" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pipeline" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Templates" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    await waitFor(() => expect(supabaseMocks.signOut).toHaveBeenCalled());
    expect(routerMocks.replace).toHaveBeenCalledWith("/login");
    expect(routerMocks.refresh).toHaveBeenCalled();
  });

  it("limits partner navigation to the partner panel plus logout", () => {
    const labels = getVisibleNavigationItems("partner").map((item) => item.label);

    expect(labels).toEqual(["Parceiro/Bruno"]);
  });
});
