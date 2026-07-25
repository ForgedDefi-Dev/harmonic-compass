import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("complete showcase journey stays musical and human-led", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "The full showcase is covered by desktop engines.");
  await page.goto("/?showcase=1");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page.getByRole("region", { name: "Harmonic Compass" })).toBeVisible();
  await expect(page.getByText("Guided showcase")).toBeVisible();

  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.locator(".compass-node").filter({ hasText: "SURPRISE" }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "SURPRISE" })).toBeVisible();

  await page.getByRole("button", { name: /More hopeful/ }).click();
  await expect(page.locator(".route-option")).toHaveCount(3);

  await page.getByRole("button", { name: "Ask Compass", exact: true }).click();
  await page.getByRole("button", { name: "Why did that work?" }).click();
  await expect(page.locator(".mentor-message--coach")).toHaveCount(2);
  await expect(page.locator(".mentor-message--coach").last()).toContainText(
    /route|works|because|resolution/i,
  );
  await page.getByRole("button", { name: "Close mentor" }).click();

  await page.getByRole("button", { name: "Build", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Borrowed Light" })).toBeVisible();
  await page.getByRole("button", { name: "Save version" }).click();
  await expect(page.getByRole("button", { name: "Saved locally" })).toBeVisible();

  await page.getByRole("button", { name: "Grow", exact: true }).click();
  await page.getByRole("button", { name: "Begin challenge" }).click();
  await page.getByRole("button", { name: "C", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("That’s home");

  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByPlaceholder("Search your music…").fill("Blue Hour");
  await expect(page.getByText("Blue Hour")).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag21a"]).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.screenshot({ path: testInfo.outputPath("showcase-final.png"), fullPage: true });
});

test("phone layout keeps the Compass and navigation usable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?showcase=1");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Harmonic Compass" })).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Grow", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Find home without the map." })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("phone-grow.png"), fullPage: true });
});

test("guitar previews and workspace controls produce visible state changes", async ({
  page,
}, testInfo) => {
  await page.goto("/?showcase=1");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Manual", exact: true }).click();
  await page
    .locator(".manual-chord-picker")
    .getByRole("button", { name: "C", exact: true })
    .click();

  await page.locator(".compass-node").filter({ hasText: "SURPRISE" }).first().click();
  await expect(page.getByLabel(/Fm guitar chord diagram/)).toBeVisible();
  await page.getByRole("button", { name: "Arpeggio", exact: true }).click();
  await expect(page.getByRole("button", { name: "Arpeggio", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  if (testInfo.project.name !== "mobile") {
    await page.getByRole("button", { name: "Preview Fm as arpeggio" }).click();
  }
  await expect(page.getByRole("button", { name: "Preview Fm as arpeggio" })).toBeEnabled();

  await page
    .getByRole("button", { name: "Open settings" })
    .evaluate((button: HTMLButtonElement) => button.click());
  const settings = page.getByRole("complementary", { name: "Settings" });
  await expect(settings).toBeVisible();
  await page.getByRole("switch", { name: /Higher contrast/ }).click();
  await expect(page.getByRole("switch", { name: /Higher contrast/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await settings.getByRole("button", { name: "Close settings" }).click();

  if (testInfo.project.name === "mobile") return;

  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByRole("button", { name: "Add section" }).click();
  await expect(page.getByRole("tab", { name: /Section 4/ })).toBeVisible();
  await page.getByRole("button", { name: "Duplicate section" }).click();
  await expect(page.getByRole("tab", { name: /Section 4 copy/ })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("tab", { name: /Section 4 copy/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Loop", exact: true }).click();
  await expect(page.getByRole("button", { name: "Looping" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Sort by name" }).click();
  await expect(page.getByRole("button", { name: "Sort by last updated" })).toBeVisible();
  await page.getByRole("button", { name: "More options for Borrowed Light" }).click();
  await expect(page.getByRole("button", { name: "Preview guitar" })).toBeVisible();
});
