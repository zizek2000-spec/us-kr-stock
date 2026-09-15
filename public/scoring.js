const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const finite=Number.isFinite;
export function observationScore(item,now=Date.now()) {
  const q=item?.quote, parts=[];
  const valid=q&&finite(q.price)&&q.price>0&&finite(Date.parse(q.asOf))&&now-Date.parse(q.asOf)<=96*3600000&&Date.parse(q.asOf)<=now+300000;
  const add=(name,max,value,reason)=>parts.push({name,max,points:finite(value)?Math.round(clamp(value)*max*10)/10:null,reason});
  const change=valid&&finite(q.change)?q.change:null;
  add('20일 추세',25,valid&&q.ma20>0?0.5+(q.price/q.ma20-1)*5:null,'직전 20일 평균 대비 -10%→0점, 동일→절반, +10%→만점');
  add('일간 모멘텀',20,change!==null?(change+5)/10:null,'전일 대비 -5%→0점, 0%→절반, +5%→만점');
  add('상승 거래량',15,valid&&q.completed===true&&finite(q.volumeRatio)&&change!==null?(change>0?q.volumeRatio/2:0):null,'완료된 장에서 상승한 경우 평균 거래량의 2배→만점. 하락·보합은 0점');
  add('급변 억제',20,change!==null?1-Math.abs(change)/7:null,'일간 절대 등락률 0%→만점, 7% 이상→0점');
  if(item.market==='KR') add('외국인·기관 수급',20,valid&&item.flow?.date===q.sessionDate&&finite(item.flow?.ratio)?0.5+item.flow.ratio*5:null,'동일 기준일 합산 순매수/거래량 -10%→0점, 0%→절반, +10%→만점');
  const total=parts.reduce((s,p)=>s+p.max,0),available=parts.filter(p=>p.points!==null).reduce((s,p)=>s+p.max,0);
  const raw=parts.reduce((s,p)=>s+(p.points??0),0),coverage=Math.round(available/total*100);
  const warning=change!==null&&(change<=-5||change>=7);
  // Normalize only measured factors, expose coverage; missing factors never become zero evidence.
  const value=valid&&coverage>=60?Math.round(raw/available*100):null;
  return {value,coverage,parts,available,total,warning,provisional:available<total,version:'observation-v1',note:'관찰 우선순위 · 상승확률 또는 매수 추천 아님 · 백테스트 전'};
}
