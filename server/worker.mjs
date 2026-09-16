import { handleBackup, d1Repository } from './api.mjs';
export default {
  async fetch(request, env) {
    const path=new URL(request.url).pathname;
    if (path==='/api/backup') return handleBackup(request,env.SYNC_TOKEN,env.DB?d1Repository(env.DB):null);
    if(path.startsWith('/api/'))return new Response('Not found',{status:404});
    return env.ASSETS.fetch(request);
  },
};
