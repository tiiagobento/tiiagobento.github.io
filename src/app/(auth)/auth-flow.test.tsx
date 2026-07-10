import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/(auth)/login/page";
import RegisterPage from "@/app/(auth)/register/page";

const routerMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: supabaseMocks,
  },
}));

async function renderCrmHook() {
  vi.resetModules();
  const { useCrmData } = await import("@/hooks/use-crm-data");
  return renderHook(() => useCrmData());
}

describe("auth flow", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("logs in with Supabase Auth and redirects to dashboard", async () => {
    supabaseMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    supabaseMocks.signInWithPassword.mockResolvedValue({ error: null });
    const { container } = render(<LoginPage />);

    await screen.findByRole("button", { name: "Entrar" });
    fireEvent.change(container.querySelector('input[type="email"]') as HTMLInputElement, { target: { value: "tiago@example.com" } });
    fireEvent.change(container.querySelector('input[type="password"]') as HTMLInputElement, { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(supabaseMocks.signInWithPassword).toHaveBeenCalledWith({ email: "tiago@example.com", password: "secret123" }));
    expect(routerMocks.replace).toHaveBeenCalledWith("/dashboard");
    expect(routerMocks.refresh).toHaveBeenCalled();
  });

  it("registers a user through Supabase Auth", async () => {
    supabaseMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    supabaseMocks.signUp.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
    const { container } = render(<RegisterPage />);

    await screen.findByRole("button", { name: "Cadastrar" });
    fireEvent.change(container.querySelector('input:not([type]), input[type="text"]') as HTMLInputElement, { target: { value: "Tiago" } });
    fireEvent.change(container.querySelector('input[type="email"]') as HTMLInputElement, { target: { value: "tiago@example.com" } });
    fireEvent.change(container.querySelector('input[type="password"]') as HTMLInputElement, { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));

    await waitFor(() =>
      expect(supabaseMocks.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "tiago@example.com",
          password: "secret123",
          options: expect.objectContaining({ data: { name: "Tiago" } }),
        }),
      ),
    );
    expect(routerMocks.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("logs out and clears CRM session state", async () => {
    supabaseMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    supabaseMocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    supabaseMocks.signOut.mockResolvedValue({ error: null });

    const { result } = await renderCrmHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(supabaseMocks.signOut).toHaveBeenCalled();
    expect(result.current.userEmail).toBeNull();
    expect(result.current.leads).toEqual([]);
  });
});
