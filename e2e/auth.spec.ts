import { expect, test } from "@playwright/test";

test.describe("auth and route protection", () => {
  test("redirects unauthenticated dashboard access to login", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /entrar no crm/i })).toBeVisible();
  });

  test("redirects unauthenticated partner access to login", async ({ page }) => {
    await page.goto("/partner", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /entrar no crm/i })).toBeVisible();
  });

  test("renders login form", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /entrar no crm/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });

  test("renders registration form", async ({ page }) => {
    await page.goto("/register", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /criar acesso/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Cadastrar" })).toBeVisible();
  });
});
