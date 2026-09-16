import {collect} from '../lib/market.js';import {mkdir,writeFile} from 'node:fs/promises';
let data;
try {const r=await fetch('https://us-kr-market-radar.vercel.app/api/market',{signal:AbortSignal.timeout(55000)});if(!r.ok)throw Error();data=await r.json();if(!Array.isArray(data.items))throw Error()}catch {data=await collect()}
if(data.items.filter(i=>i.quote).length<Math.ceil(data.items.length*.7))throw Error('가격 수집 성공률 70% 미만: 이전 스냅샷 보존');
await mkdir('public/data',{recursive:true});await writeFile('public/data/snapshot.json',JSON.stringify(data));
if(data.calendar&&typeof data.calendar.open==='boolean')await writeFile('public/data/calendar.json',JSON.stringify(data.calendar));
const report=data.morning;
if(report?.status==='ready'&&Date.parse(report.generatedAt)<Date.parse(report.expiresAt)&&Date.now()<Date.parse(report.expiresAt))await writeFile('public/data/morning.json',JSON.stringify(report));
console.log('Snapshot:',data.generatedAt,'quotes',data.items.filter(i=>i.quote).length,'morning',report?.status||'not available');
