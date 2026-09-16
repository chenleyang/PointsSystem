const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
globalThis.crypto ||= require('node:crypto').webcrypto;
const root = path.resolve(__dirname, '..');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8'};
const folder=process.env.BACKUP_DATA_DIR?path.resolve(process.env.BACKUP_DATA_DIR):path.join(root,'.local-data');
const backupFile=path.join(folder,'cloud-backup.json');
const secret=process.env.SYNC_TOKEN || 'local-demo-sync-key-2026';
// Local-only adapter. Production uses D1 with atomic revision checks.
const repository={
  get(){return fs.existsSync(backupFile)?JSON.parse(fs.readFileSync(backupFile,'utf8')):null;},
  save(base,row){
    const current=this.get();if((current?.revision||0)!==base)return false;
    fs.mkdirSync(folder,{recursive:true});
    fs.writeFileSync(backupFile+'.tmp',JSON.stringify(row));
    fs.renameSync(backupFile+'.tmp',backupFile);return true;
  },
};
(async()=>{
  const {handleBackup}=await import(pathToFileURL(path.join(root,'server/api.mjs')));
  http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/api/backup'){
        const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:req,duplex:'half'})});
        const response=await handleBackup(request,secret,repository);
        res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));
      }
      const allowed={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/mobile.css':'mobile.css','/app.js':'app.js','/cloud.js':'cloud.js','/validation.mjs':'validation.mjs'};
      const name=allowed[url.pathname];
      if(!name){res.writeHead(404);return res.end('Not found');}
      res.writeHead(200,{'Content-Type':types[path.extname(name)],'Cache-Control':'no-store'});
      fs.createReadStream(path.join(root,name)).pipe(res);
    }catch{res.writeHead(500);res.end('Local server error');}
  }).listen(Number(process.env.PORT)||5173,'127.0.0.1',()=>console.log('Preview: http://localhost:'+(process.env.PORT||5173)+' (local cloud backup enabled)'));
})();
