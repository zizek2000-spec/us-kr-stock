import {collect,universe} from '../lib/market.js';
import {morningReport} from '../public/morning.js';
import {preserveMorning} from '../lib/morning-store.js';
import {enrichKis} from '../lib/kis.js';
async function combined(){const [data,kis]=await Promise.all([collect(),enrichKis({items:universe.filter(i=>i.market==='KR').map(i=>({...i}))})]);for(const item of data.items){const k=kis.items.find(k=>k.symbol===item.symbol);if(k?.quote)Object.assign(item,k);else if(k?.kisError)item.kisError=k.kisError;}const result={...data,kis:kis.kis,calendar:kis.calendar};return {...result,morning:await preserveMorning(morningReport(result))};}
let cached=null;let inflight=null;
export async function getMarketData(){if(!cached||Date.now()-Date.parse(cached.generatedAt)>(cached.kis?.configured&&!cached.kis?.connected?65000:300000)){inflight??=combined().finally(()=>{inflight=null});cached=await inflight;}return cached;}
export default async function handler(req,res){if(req.method!=='GET')return res.status(405).json({error:'GET only'});try{cached=await getMarketData();const ok=cached.items.some(i=>i.quote);res.setHeader('Cache-Control',ok?(cached.kis?.configured&&!cached.kis?.connected?'public, s-maxage=30':'public, s-maxage=300, stale-while-revalidate=60'):'no-store');return res.status(ok?200:503).json(cached);}catch{res.status(503).json({error:'시세 공급자 연결 실패. 잠시 후 다시 시도하세요.'})}}
