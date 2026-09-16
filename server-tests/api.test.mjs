import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {handleBackup,MAX_BYTES} from '../server/api.mjs';
globalThis.crypto ||= webcrypto;
const secret='test-shared-secret-2026';
const data={version:1,settings:{title:'测试',rate:10,lowBalance:1000},customers:[],categories:[],packages:[],transactions:[]};
function repository(){let row=null;return {get:async()=>row,save:async(base,next)=>{if((row?.revision||0)!==base)return false;row=next;return true;}};}
const req=(method='GET',body,token=secret)=>new Request('https://example.com/api/backup?download=1',{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
test('鉴权、读写、冲突保护与错误备份不改变云端资料',async()=>{
  const repo=repository();
  assert.equal((await handleBackup(req('GET',null,'bad'),secret,repo)).status,401);
  assert.equal((await handleBackup(req(),'short',repo)).status,503);
  assert.equal((await handleBackup(req('POST'),secret,repo)).status,405);
  const results=await Promise.all([handleBackup(req('PUT',{baseRevision:0,data}),secret,repo),handleBackup(req('PUT',{baseRevision:0,data}),secret,repo)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const invalid=structuredClone(data);invalid.customers=[{id:'a',name:'工厂',phone:'123456',category:'外套',points:10,machines:1}];invalid.categories=['外套'];
  assert.equal((await handleBackup(req('PUT',{baseRevision:1,data:invalid}),secret,repo)).status,400);
  assert.equal((await handleBackup(req('PUT',{baseRevision:1,data:{...data,padding:'x'.repeat(MAX_BYTES)}}),secret,repo)).status,413);
  const result=await(await handleBackup(req(),secret,repo)).json();
  assert.equal(result.revision,1);assert.deepEqual(result.data,data);
  assert.equal((await handleBackup(req('PUT',{baseRevision:1,data}),secret,repo)).status,200);
  assert.equal((await handleBackup(req('PUT',{baseRevision:1,data}),secret,repo)).status,409);
});
