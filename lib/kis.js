// Fixed, read-only market endpoints. Credentials never leave the server response boundary.
const base = 'https://openapi.koreainvestment.com:9443';
const paths = {calendar: ['/uapi/domestic-stock/v1/quotations/chk-holiday','CTCA0903R'], daily: ['/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice', 'FHKST03010100'], investor: ['/uapi/domestic-stock/v1/quotations/inquire-investor', 'FHKST01010900']};
let calendarCache;
let token, expires = 0, pending, nextAuth = 0;
const numeric = v => v !== null && v !== undefined && String(v).trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
const date = t => new Date(t + 9 * 3600000).toISOString().slice(0,10).replaceAll('-','');
export function configured() { return Boolean(process.env.KIS_APP_KEY && process.env.KIS_APP_SECRET); }
async function accessToken() {
  if (token && Date.now() < expires) return token;
  if (pending) return pending;
  if (Date.now() < nextAuth) throw Error('KIS 인증 재시도 대기');
  nextAuth = Date.now() + 65000;
  pending = (async () => {
    const r = await fetch(base + '/oauth2/tokenP', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({grant_type:'client_credentials',appkey:process.env.KIS_APP_KEY,appsecret:process.env.KIS_APP_SECRET}), signal:AbortSignal.timeout(8000)});
    const body = await r.json();
    if (!r.ok || !body.access_token) throw Error('KIS 인증 실패 · 환경변수와 API 사용 상태 확인');
    token = body.access_token;
    expires = Date.now() + Math.max(0,(Number(body.expires_in)||86400)-300)*1000;
    return token;
  })().finally(()=>{pending=null});
  return pending;
}
async function request(kind, params, bearer) {
  const [path, tr] = paths[kind];
  const r = await fetch(base + path + '?' + new URLSearchParams(params), {headers:{'Content-Type':'application/json',authorization:'Bearer '+bearer,appkey:process.env.KIS_APP_KEY,appsecret:process.env.KIS_APP_SECRET,tr_id:tr,custtype:'P'},signal:AbortSignal.timeout(5000)});
  const body = await r.json();
  if (!r.ok || body.rt_cd !== '0') throw Error('KIS 조회 실패');
  return body;
}
export function parseDaily(body, symbol, now=Date.now()) {
  const today=date(now), hour=new Date(now+9*3600000).getUTCHours();
  const rows=(body.output2||[]).filter(r=>/^\d{8}$/.test(r.stck_bsop_date)&&r.stck_bsop_date<=today&&(r.stck_bsop_date<today||hour>=16)&&numeric(r.stck_clpr)>0).sort((a,b)=>b.stck_bsop_date.localeCompare(a.stck_bsop_date));
  const last=rows[0]; if(!last) throw Error('KIS 완료된 일봉 없음');
  const d=last.stck_bsop_date, asOf=`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T15:30:00+09:00`;
  const prior=rows.slice(1,21), price=numeric(last.stck_clpr), previous=numeric(rows[1]?.stck_clpr), volume=numeric(last.acml_vol);
  const avgVolume=prior.length===20&&prior.every(r=>numeric(r.acml_vol)!==null)?prior.reduce((s,r)=>s+numeric(r.acml_vol),0)/20:null;
  return {price,previous,change:previous?(price/previous-1)*100:null,currency:'KRW',asOf,sessionDate:d,ageHours:(now-Date.parse(asOf))/3600000,stale:now-Date.parse(asOf)>96*3600000,ma20:prior.length===20?prior.reduce((s,r)=>s+numeric(r.stck_clpr),0)/20:null,volume,volumeRatio:avgVolume>0&&volume!==null?volume/avgVolume:null,completed:true,source:'한국투자증권 · KRX 완료 일봉',sourceUrl:'https://apiportal.koreainvestment.com/apiservice-category',session:'KRX 최근 완료 정규장 종가'};
}
export function parseFlow(body, q) {
  const r=(body.output||[]).find(r=>r.stck_bsop_date===q.sessionDate);
  const foreign=numeric(r?.frgn_ntby_qty), institution=numeric(r?.orgn_ntby_qty);
  return foreign!==null&&institution!==null?{date:q.sessionDate,foreign,institution,ratio:q.volume>0?(foreign+institution)/q.volume:null,source:'한국투자증권 · KRX 투자자'}:null;
}
export async function enrichKis(data) {
  if (!configured()) return {...data,kis:{configured:false,connected:false,count:0,message:'KIS 키 미설정'}};
  let bearer;try {bearer=await accessToken()} catch {return {...data,kis:{configured:true,connected:false,count:0,message:'KIS 인증 실패 또는 재발급 대기 · 보조 시세 사용'}}}
  let count=0,flows=0;
  const today=date(Date.now());
  if(calendarCache?.date!==today){
    try{const saved=await fetch('https://raw.githubusercontent.com/zizek2000-spec/us-kr-stock/main/public/data/calendar.json',{signal:AbortSignal.timeout(3000)});if(saved.ok){const c=await saved.json();if(c.date===today&&typeof c.open==='boolean')calendarCache=c}}catch{}
    if(calendarCache?.date!==today){try{const c=await request('calendar',{BASS_DT:today,CTX_AREA_FK:'',CTX_AREA_NK:''},bearer);const rows=Array.isArray(c.output)?c.output:[c.output];const row=rows.find(r=>r?.bass_dt===today);calendarCache={date:today,open:row?.opnd_yn==='Y'?true:row?.opnd_yn==='N'?false:null}}catch{calendarCache={date:today,open:null}}}
  }
  data.calendar=calendarCache;
  const started=Date.now();
  for (const item of data.items.filter(i=>i.market==='KR')) {
    if(Date.now()-started>22000) break;
    const params={FID_COND_MRKT_DIV_CODE:'J',FID_INPUT_ISCD:item.symbol.split('.')[0]};
    try {
      const daily=await request('daily',{...params,FID_INPUT_DATE_1:date(Date.now()-160*86400000),FID_INPUT_DATE_2:date(Date.now()),FID_PERIOD_DIV_CODE:'D',FID_ORG_ADJ_PRC:'0'},bearer);
      item.quote=parseDaily(daily,item.symbol);delete item.error;count++;
      await new Promise(resolve=>setTimeout(resolve,120));
      try {item.flow=parseFlow(await request('investor',params,bearer),item.quote);if(item.flow)flows++}catch {item.flow=null}
    } catch {item.kisError='KIS 시세 조회 실패 · 보조 시세 사용'}
    await new Promise(resolve=>setTimeout(resolve,120));
  }
  return {...data,generatedAt:new Date().toISOString(),kis:{configured:true,connected:count>0,count,flows,message:`KIS 종가 ${count}/10 · 동일 기준일 수급 ${flows}/10`}};
}
