const { test, expect } = require('@playwright/test');

test('主题切换持久化，本地备份保留且云端入口隐藏', async ({ page }) => {
  await page.goto('/#backup');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByLabel('界面主题').selectOption('dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name: '云端共享备份' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '下载完整备份' })).toBeVisible();
  await expect(page.locator('#import-file')).toBeVisible();
});

test('手机查询弹窗、重置、日期校验及桌面布局恢复', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#filter-form')).not.toBeVisible();
  expect((await page.locator('.stat').first().boundingBox()).height).toBeLessThan(80);
  expect((await page.locator('tbody tr').first().boundingBox()).height).toBeLessThan(180);
  await page.getByRole('button', { name: '查询', exact: true }).click();
  await page.getByLabel('工厂名称', { exact: true }).fill('锦程');
  await page.locator('#filter-dialog').getByRole('button', { name: '查询', exact: true }).click();
  await expect(page.locator('#filter-dialog')).not.toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: '查询 (1)', exact: true }).click();
  await expect(page.getByLabel('工厂名称', { exact: true })).toHaveValue('锦程');
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(6);
  await page.getByRole('button', { name: '查询', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#filter-dialog')).not.toBeVisible();
  await page.goto('/#ledger');
  await page.getByRole('button', { name: '查询', exact: true }).click();
  await page.getByLabel('开始日期').fill('2026-09-20');
  await page.getByLabel('结束日期').fill('2026-09-01');
  await page.locator('#filter-dialog').getByRole('button', { name: '查询', exact: true }).click();
  await expect(page.locator('#filter-dialog')).toBeVisible();
  await expect(page.locator('#toast')).toContainText('开始日期不能晚于结束日期');
  await expect(page.locator('#filter-dialog').getByRole('alert')).toHaveText('开始日期不能晚于结束日期');
  await page.setViewportSize({ width: 1440, height: 960 });
  await expect(page.locator('#filter-dialog')).not.toBeVisible();
  await expect(page.locator('#ledger-filter')).toBeVisible();
});
