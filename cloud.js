const DATA_KEY = 'factory-points-v1';
const BASE_KEY = 'factory-cloud-base-v1';
const TOKEN_KEY = 'factory-cloud-token';
const RECOVERY_KEY = 'factory-before-cloud-restore';

export function createCloudSync(ui) {
  let token = '', meta = null, busy = false, message = '输入共享密钥，连接本系统的云端备份。';
  try { token = sessionStorage.getItem(TOKEN_KEY) || ''; } catch {}
  function baseline() { try { return JSON.parse(localStorage.getItem(BASE_KEY)); } catch { return null; } }
  function markBase(revision, serialized) {
    localStorage.setItem(BASE_KEY, JSON.stringify({ revision, serialized }));
  }
  function show() { if (location.hash === '#backup') ui.render(); }
  function statusText() {
    if (!meta) return message;
    if (!meta.revision) return '云端还没有备份，可以上传当前资料。';
    const base = baseline();
    if (!base || base.revision !== meta.revision) return '云端有待下载的资料。请先备份本地数据，再下载云端资料。';
    return base.serialized === ui.getSnapshot() ? '当前资料与上次同步一致。' : '本地资料有修改，尚未上传云端。';
  }
  function markup() {
    let recovery = false; try { recovery = !!localStorage.getItem(RECOVERY_KEY); } catch {}
    return `<section class="panel cloud-panel"><div class="panel-header"><h2>云端共享备份</h2><span class="tag">手动同步</span></div><div class="content-pad">
      <p class="help">在一台设备上传，在另一台设备下载。所有设备打开同一网址并使用同一密钥；下载会替换本地资料，不会自动合并。</p>
      <form id="cloud-connect" class="cloud-connect"><div class="field"><label for="cloud-token">共享密钥</label><input id="cloud-token" name="token" type="password" autocomplete="off" required maxlength="256" placeholder="输入管理员设置的共享密钥" value="${ui.esc(token)}"></div><button class="button secondary" ${busy?'disabled':''}>连接 / 刷新状态</button></form>
      <p class="help">密钥只保留在当前标签页会话，不会写入备份文件。</p>
      <div class="cloud-status" role="status">${ui.esc(busy?'正在连接云端，请稍候…':statusText())}</div>
      ${meta?.revision?`<div class="cloud-summary"><span>云端版本 <strong>v${meta.revision}</strong></span><span>更新于 <strong>${ui.esc(new Date(meta.updatedAt).toLocaleString('zh-CN',{hour12:false}))}</strong></span><span>${meta.customers} 个客户 · ${meta.transactions} 条流水</span></div>`:''}
      <div class="backup-actions"><button type="button" class="button primary" data-cloud="upload" ${busy||!meta?'disabled':''}>上传本机资料</button><button type="button" class="button secondary" data-cloud="download" ${busy||!meta?.revision?'disabled':''}>下载云端资料</button><button type="button" class="button secondary" data-cloud="disconnect" ${busy||!token?'disabled':''}>断开连接</button>${recovery?'<button type="button" class="button secondary" data-cloud="recovery">导出下载前的本地资料</button>':''}</div>
    </div></section>`;
  }
  async function api(method = 'GET', payload, download = false) {
    if (!token) throw Error('请先输入共享密钥并连接');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('/api/backup' + (download?'?download=1':''), {
        method, headers: { Authorization: 'Bearer ' + token, ...(payload?{'Content-Type':'application/json'}:{}) },
        body: payload?JSON.stringify(payload):undefined, signal: controller.signal, cache: 'no-store',
      });
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) throw Error('此站点未配置云端服务，请按部署说明启用云备份');
      const result = await response.json();
      if (!response.ok) throw Error(result.error || '云端请求失败');
      return result;
    } catch (error) {
      if (error.name === 'AbortError') throw Error('连接超时，请检查网络后刷新状态；上传可能已完成，请勿直接重复提交');
      if (error instanceof TypeError) throw Error('无法连接服务器，请检查网络后重试');
      throw error;
    } finally { clearTimeout(timer); }
  }
  async function run(fn) {
    if (busy) return false;
    busy = true; show();
    try { return await fn(); }
    catch (error) { message = error.message; meta = null; ui.toast(error.message); return false; }
    finally { busy = false; show(); }
  }
  function currentSnapshot() {
    const current = localStorage.getItem(DATA_KEY);
    if (current !== ui.getSnapshot()) throw Error('其他窗口已修改本地资料，请刷新页面后再同步');
    ui.validate(ui.getData());
    return current;
  }
  document.addEventListener('submit', event => {
    if (event.target.id !== 'cloud-connect') return;
    event.preventDefault();
    token = new FormData(event.target).get('token').trim();
    try { sessionStorage.setItem(TOKEN_KEY, token); } catch {}
    run(async () => { meta = await api(); message = '已连接云端'; });
  });
  document.addEventListener('click', event => {
    const action = event.target.closest('[data-cloud]')?.dataset.cloud;
    if (!action || busy) return;
    if (action === 'disconnect') {
      token = ''; meta = null; message = '已断开连接，本地资料保留。';
      try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
      show(); return;
    }
    if (action === 'recovery') {
      const saved = localStorage.getItem(RECOVERY_KEY);
      if (saved) ui.download(saved,'云端下载前的本地资料.json','application/json');
      return;
    }
    if (action === 'upload') {
      const base = baseline();
      if (meta?.revision && base?.revision !== meta.revision) {
        ui.toast('云端版本已更新或本机尚未同步，请先导出本地备份，再下载云端资料'); return;
      }
      let serialized;
      try { serialized = currentSnapshot(); } catch(error) { ui.toast(error.message); return; }
      const revision = meta?.revision || 0;
      ui.confirmAction('确认上传云端',`将上传本机 ${ui.getData().customers.length} 个客户和 ${ui.getData().transactions.length} 条流水，替换云端当前资料。其他设备下载后即可使用。`,()=>run(async()=>{
        if (currentSnapshot() !== serialized) throw Error('确认期间本地资料已变化，请重新上传');
        meta = await api('PUT',{baseRevision:revision,data:JSON.parse(serialized)});
        markBase(meta.revision,serialized);
        ui.toast('上传成功，其他设备现在可以下载');
        return true;
      }),'确认上传');
    }
    if (action === 'download') run(async()=>{
      const result = await api('GET',undefined,true);
      if (!result.revision || !result.data) throw Error('云端暂无资料');
      ui.validate(result.data);
      const before = localStorage.getItem(DATA_KEY);
      ui.confirmAction('确认下载并替换',`云端 v${result.revision} 包含 ${result.customers} 个客户、${result.transactions} 条流水。下载会覆盖本机全部资料，覆盖前会自动保留一份本地恢复副本。`,()=>{
        if (localStorage.getItem(DATA_KEY) !== before) throw Error('确认期间本地资料已变化，请重新下载');
        // Save recovery before replacing anything. A quota failure aborts the restore.
        if (before) localStorage.setItem(RECOVERY_KEY,before);
        if (!ui.restore(result.data)) return false;
        markBase(result.revision,ui.getSnapshot());
        meta = result; delete meta.data;
        ui.toast('下载完成，本机资料已更新');
        return true;
      },'下载并替换');
    });
  });
  return { markup };
}
