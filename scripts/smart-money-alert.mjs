// Run hourly by GitHub Actions. Only announces NEW Form 4 submission links, not buys.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const statePath='public/data/smart-money-seen.json';
const agent=process.env.SEC_USER_AGENT, token=process.env.TELEGRAM_BOT_TOKEN,chat=process.env.TELEGRAM_CHAT_ID;
if(!agent){console.log('SEC_USER_AGENT missing; no alerts');process.exit(0)}
const response=await fetch('https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&owner=only&count=40&output=atom',{headers:{'User-Agent':agent,'Accept':'application/atom+xml'},signal:AbortSignal.timeout(15000)});
if(!response.ok)throw Error('SEC status '+response.status);
const xml=await response.text();
const entries=[...(xml.matchAll(/<entry\b[^>]*>[\s\S]*?<\/entry>/gi))].map(m=>m[0]);
const val=(x,t)=>x.match(new RegExp('<'+t+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+t+'>','i'))?.[1]?.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&')?.trim()||'';
const current=entries.map(x=>({id:val(x,'id'),title:val(x,'title'),link:x.match(/<link\b[^>]*href="([^"]+)"/i)?.[1]?.replace(/&amp;/g,'&')||''})).filter(x=>x.id);
if(!current.length)throw Error('No filings parsed; preserving state');
let old=null;try{old=JSON.parse(await readFile(statePath,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
const seen=new Set(old?.ids||[]);const fresh=old?current.filter(x=>!seen.has(x.id)):[]; 
if(fresh.length&&(!token||!chat)){console.log('Telegram credentials missing; preserve state so notifications are not silently lost');process.exit(0)}
for(const item of fresh.slice(0,15).reverse()){
 const text='📋 SEC Form 4 신규 제출 (매수 확정 아님)\n'+item.title.slice(0,220)+'\n'+item.link+'\n공개자료 알림 / 거래 방향·금액은 원문 확인';
 const r=await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chat,text,disable_web_page_preview:true}),signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('Telegram '+r.status);
}
await mkdir('public/data',{recursive:true});
await writeFile(statePath,JSON.stringify({updatedAt:new Date().toISOString(),ids:[...new Set([...current.map(x=>x.id),...seen])].slice(0,4000)},null,2)+'\n');
console.log(old?'Notifications sent '+fresh.slice(0,15).length:'Baseline created; no historical spam');
