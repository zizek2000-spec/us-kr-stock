import {collect} from '../lib/market.js';
let cached=null;let inflight=null;

function cacheWindowMs(now=new Date()){
 const kst=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const get=t=>kst.find(p=>p.type===t)?.value;
 const day=get('weekday'),minutes=Number(get('hour'))*60+Number(get('minute'));
 const monFri=['Mon','Tue','Wed','Thu','Fri'].includes(day);
 const tueSat=['Tue','Wed','Thu','Fri','Sat'].includes(day);
 // 한국장: 09:00~15:30 KST. 개장 30분 전부터 5분 주기로 전환.
 const krActive=monFri&&minutes>=8*60+30&&minutes<16*60;
 // 미국장: DST/표준시 모두 포함하도록 22:00~06:30 KST를 활성 구간으로 둔다.
 const usActive=(monFri&&minutes>=22*60)||(tueSat&&minutes<6*60+30);
 if(krActive||usActive)return 300000;
 const weekend=(day==='Sun')||(day==='Sat'&&minutes>=6*60+30)||(day==='Mon'&&minutes<6*60+30);
 return weekend?3600000:1800000;
}

export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'GET only'});
 try{
  const ttl=cacheWindowMs();
  if(!cached||Date.now()-Date.parse(cached.generatedAt)>ttl){
   inflight??=collect().finally(()=>{inflight=null});
   cached=await inflight;
  }
  const ok=cached.items.some(i=>i.quote);
  const ttlSeconds=Math.floor(ttl/1000);
  res.setHeader('Cache-Control',ok?`public, s-maxage=${ttlSeconds}, stale-while-revalidate=60`:'no-store');
  res.setHeader('X-Market-Cache-Ttl',String(ttlSeconds));
  return res.status(ok?200:503).json(cached);
 }catch{
  res.status(503).json({error:'시세 공급자 연결 실패. 잠시 후 다시 시도하세요.'});
 }
}
