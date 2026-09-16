import {getCache} from '@vercel/functions';
export async function preserveMorning(report) {
  if(!process.env.VERCEL)return report;
  try {
    const cache=getCache({namespace:'morning-reports'});
    if(report.status==='ready'){
      await cache.set('latest',report,{ttl:604800});
      return report;
    }
    if(report.status==='closed')return report;
    const saved=await cache.get('latest');
    if(saved?.status==='ready'&&Date.parse(saved.generatedAt)<Date.parse(saved.expiresAt))return saved;
  }catch{}
  return report;
}
