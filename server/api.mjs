import { validate } from '../validation.mjs';

// D1 rows are limited in size. Keep snapshots below 1 MB, including UTF-8 text.
export const MAX_BYTES = 900_000;
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff' },
});
function metadata(row) {
  if (!row) return { revision:0 };
  const data = JSON.parse(row.payload);
  return { revision:row.revision,updatedAt:row.updatedAt,customers:data.customers.length,transactions:data.transactions.length };
}
async function authorized(request, secret) {
  const supplied = request.headers.get('Authorization') || '';
  const digest = value => crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  const [a,b] = await Promise.all([digest(supplied),digest('Bearer '+secret)]);
  const aa=new Uint8Array(a),bb=new Uint8Array(b);let difference=0;
  for (let i=0;i<aa.length;i++) difference|=aa[i]^bb[i];
  return difference===0;
}
async function readBody(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) throw Error('TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) throw Error('EMPTY');
  const chunks=[];let size=0;
  while (true) {
    const {done,value}=await reader.read();if(done)break;
    size+=value.byteLength;
    if(size>MAX_BYTES){await reader.cancel();throw Error('TOO_LARGE');}
    chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function handleBackup(request, secret, repository) {
  if (!secret || secret.length<16 || !repository) return json({error:'云端服务尚未配置，请设置数据库和至少 16 位的共享密钥'},503);
  if (!await authorized(request,secret)) return json({error:'共享密钥不正确，请重新输入'},401);
  if (!['GET','PUT'].includes(request.method)) return json({error:'不支持此请求方式'},405);
  try {
    if (request.method==='GET') {
      const row=await repository.get();
      return json({...metadata(row),...(row&&new URL(request.url).searchParams.get('download')==='1'?{data:JSON.parse(row.payload)}:{})});
    }
    if (!request.headers.get('Content-Type')?.includes('application/json')) return json({error:'请提交 JSON 数据'},415);
    let body;
    try {
      body=await readBody(request);
      if(!Number.isSafeInteger(body.baseRevision)||body.baseRevision<0)throw Error('备份版本无效');
      validate(body.data);
    } catch(error) {
      return json({error:error.message==='TOO_LARGE'?'备份超过云端单份 900 KB 上限，请使用文件备份或扩展存储':`备份无效：${error.message}`},error.message==='TOO_LARGE'?413:400);
    }
    const row={revision:body.baseRevision+1,updatedAt:new Date().toISOString(),payload:JSON.stringify(body.data)};
    // The revision check and write must be a single atomic database statement.
    if(!await repository.save(body.baseRevision,row)) return json({error:'云端已被其他设备更新，请先导出本地备份，再下载最新资料'},409);
    return json(metadata(row));
  } catch {
    return json({error:'云端存储暂时不可用，请稍后重试'},500);
  }
}

export function d1Repository(db) {
  return {
    get:()=>db.prepare('SELECT revision, updated_at AS updatedAt, payload FROM shared_backup WHERE id = 1').first(),
    async save(base,row) {
      const statement=base===0
        ?db.prepare('INSERT INTO shared_backup (id, revision, updated_at, payload) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO NOTHING').bind(row.revision,row.updatedAt,row.payload)
        :db.prepare('UPDATE shared_backup SET revision = ?, updated_at = ?, payload = ? WHERE id = 1 AND revision = ?').bind(row.revision,row.updatedAt,row.payload,base);
      const result=await statement.run();return result.meta.changes===1;
    },
  };
}
