import { test, expect } from "./fixtures";

// localStorage demo-mode always seeds a few sample clients (Анна Смирнова,
// Михаил Иванов, ООО «Альфа», Сергей Петров — see localStorageProvider.ts),
// so the empty-state "Добавить первого клиента" screen never appears here;
// tests use the standard "+ Добавить клиента" header button instead. Test
// client names avoid any substring overlap with the seed names above,
// since Playwright's getByText does substring matching by default.

test.describe("board", () => {
  test("adds a client and shows it on the board", async ({ page }) => {
    await page.getByRole("button", { name: "+ Добавить клиента" }).click();
    await page.getByLabel("Имя клиента *").fill("Тестовый Клиент1");
    await page.getByLabel("Телефон *").fill("+7 900 000-00-01");
    await page.getByRole("button", { name: "Добавить", exact: true }).click();

    await expect(page.getByText("Тестовый Клиент1")).toBeVisible();
  });

  test("changes a client's status from the table view", async ({ page }) => {
    await page.getByRole("button", { name: "+ Добавить клиента" }).click();
    await page.getByLabel("Имя клиента *").fill("Тестовый Клиент2");
    await page.getByLabel("Телефон *").fill("+7 900 000-00-02");
    await page.getByRole("button", { name: "Добавить", exact: true }).click();

    await page.getByRole("button", { name: "Таблица" }).click();
    const statusSelect = page.getByLabel("Изменить статус: Тестовый Клиент2");
    await expect(statusSelect).toHaveValue("new");
    await statusSelect.selectOption("in_progress");
    await expect(statusSelect).toHaveValue("in_progress");
  });

  test("filters clients by search term", async ({ page }) => {
    await page.getByRole("button", { name: "+ Добавить клиента" }).click();
    await page.getByLabel("Имя клиента *").fill("Уникальный Клиент3");
    await page.getByLabel("Телефон *").fill("+7 900 000-00-04");
    await page.getByRole("button", { name: "Добавить", exact: true }).click();

    await expect(page.getByText("Уникальный Клиент3")).toBeVisible();

    await page.getByLabel("Поиск по клиентам").fill("Уникальный");
    await expect(page.getByText("Уникальный Клиент3")).toBeVisible();
    // a seeded sample client should be filtered out by the search term
    await expect(page.getByText("Михаил Иванов")).not.toBeVisible();
  });

  test("opens and closes the client drawer", async ({ page }) => {
    await page.getByRole("button", { name: "+ Добавить клиента" }).click();
    await page.getByLabel("Имя клиента *").fill("Тестовый Клиент4");
    await page.getByLabel("Телефон *").fill("+7 900 000-00-05");
    await page.getByRole("button", { name: "Добавить", exact: true }).click();

    await page.getByRole("button", { name: "Таблица" }).click();
    await page.getByText("Тестовый Клиент4").click();

    const drawer = page.getByLabel("Карточка дела: Тестовый Клиент4");
    await expect(drawer).toBeVisible();

    await page.getByRole("button", { name: "Закрыть карточку" }).click();
    await expect(drawer).not.toBeVisible();
  });
});
