const {test,expect}=require('@playwright/test');
const key='factory-points-v1';
async function connect(page,token='test-only-shared-key-2026'){
  await page.getByLabel('共享密钥',{exact:true}).fill(token);
  await page.getByRole('button',{name:'连接 / 刷新状态'}).click();
  await expect(page.locator('.cloud-status')).not.toContainText('正在连接');
}
test.skip('云端共享入口暂时隐藏：独立设备上传、下载、恢复副本和过期版本拒绝',async({page,browser})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/#backup');
  await connect(page,'wrong-password');
  await expect(page.locator('.cloud-status')).toContainText('共享密钥不正确');
  await connect(page);
  await page.getByRole('button',{name:'上传本机资料',exact:true}).click();
  await page.getByRole('button',{name:'确认上传',exact:true}).click();
  await expect(page.locator('.cloud-summary')).toContainText('v1');
  const firstData=await page.evaluate(k=>localStorage.getItem(k),key);
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const other=await context.newPage();
  await other.goto('http://127.0.0.1:5174/#backup');
  const original=await other.evaluate(k=>localStorage.getItem(k),key);
  await connect(other);
  await other.getByRole('button',{name:'上传本机资料',exact:true}).click();
  await expect(other.locator('#toast')).toContainText('尚未同步');
  await other.getByRole('button',{name:'下载云端资料',exact:true}).click();
  await other.getByRole('button',{name:'下载并替换',exact:true}).click();
  await expect(other.locator('.cloud-status')).toContainText('上次同步一致');
  expect(await other.evaluate(k=>localStorage.getItem(k),key)).toBe(firstData);
  expect(await other.evaluate(()=>localStorage.getItem('factory-before-cloud-restore'))).toBe(original);
  await other.getByRole('link',{name:'系统设置',exact:true}).click();
  await other.getByLabel('系统名称',{exact:true}).fill('手机端更新后的系统');
  await other.getByRole('button',{name:'保存设置'}).click();
  await other.getByRole('link',{name:'数据备份',exact:true}).click();
  await other.getByRole('button',{name:'上传本机资料',exact:true}).click();
  await other.getByRole('button',{name:'确认上传',exact:true}).click();
  await expect(other.locator('.cloud-summary')).toContainText('v2');
  await page.getByRole('button',{name:'上传本机资料',exact:true}).click();
  await page.getByRole('button',{name:'确认上传',exact:true}).click();
  await expect(page.locator('#toast')).toContainText('已被其他设备更新');
  await page.getByRole('button',{name:'取消',exact:true}).click();
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(firstData);
  await expect(other.locator('#toast')).not.toHaveClass('visible');
  await other.screenshot({path:'test-results/mobile-cloud.png',fullPage:true});
  await context.close();
  expect(errors).toEqual([]);
});
test('320px、390px、平板页面无横向溢出，手机直接操作客户卡片',async({page})=>{
  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:844});
    for(const route of ['customers','recharge','consume','ledger','packages','categories','settings','backup']){
      await page.goto('/#'+route);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} ${route}`).toBe(true);
    }
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const row=page.getByRole('row').filter({hasText:'锦程制衣厂'});
  const button=row.getByRole('button',{name:'充值',exact:true});
  await button.scrollIntoViewIfNeeded();
  const box=await button.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);expect(box.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({path:'test-results/mobile-customer-card.png'});
  await button.click();
  await page.getByLabel('充值金额（元）').fill('100');
  await page.getByRole('button',{name:'确认充值',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const modal=await page.getByRole('dialog').boundingBox();expect(modal.x).toBe(0);expect(modal.width).toBe(390);
  await page.getByRole('dialog').getByRole('button',{name:'确认充值',exact:true}).click();
  await expect(page.locator('#toast')).toContainText('充值成功');
});
