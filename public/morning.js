import {observationScore} from './scoring.js';
export const kstDay=t=>new Date(t+9*3600000).toISOString().slice(0,10);
export function morningReport(data,now=Date.now()) {
  const targetDate=kstDay(now), hour=new Date(now+9*3600000).getUTCHours();
  const report={version:'morning-v1',targetDate,generatedAt:new Date(now).toISOString(),expiresAt:targetDate+'T09:00:00+09:00',candidates:[],assessments:[],status:'waiting',message:''};
  if(data.calendar?.date!==targetDate.replaceAll('-','')||data.calendar?.open===null||data.calendar?.open===undefined)return {...report,message:'한국장 개장일 확인 대기 · 추천 보류'};
  if(!data.calendar.open)return {...report,status:'closed',message:'한국장 휴장일 · 오늘 추천 없음'};
  if(hour<5||hour>=9)return {...report,status:'outside',message:hour<5?'미국장 마감 후 05~09시 사이에 장전 추천을 계산합니다.':'장 시작 후에는 새로운 장전 추천을 만들지 않습니다.'};
  for(const item of data.items.filter(i=>i.market==='KR')) {
    const q=item.quote, rating=observationScore(item,now), reasons=[];
    if(rating.value===null||rating.coverage<100)reasons.push('국내 가격·수급 데이터 미충족');
    if(!q?.completed||!q?.sessionDate||q.sessionDate>=targetDate.replaceAll('-',''))reasons.push('직전 한국장 완료 데이터 미확인');
    if(rating.warning)reasons.push('급락·과열 가격 경보');
    const leaders=(item.links||[]).map(symbol=>data.items.find(i=>i.symbol===symbol));
    const ready=leaders.length>0&&leaders.every(i=>i?.quote?.completed&&Number.isFinite(i.quote.change)&&Number.isFinite(Date.parse(i.quote.asOf))&&now-Date.parse(i.quote.asOf)>=0&&now-Date.parse(i.quote.asOf)<80*3600000);
    if(!ready)reasons.push('미국 관련 종목 마감 데이터 미확인');
    const usChange=ready?leaders.reduce((s,i)=>s+i.quote.change,0)/leaders.length:null;
    if(usChange!==null&&usChange<=-3)reasons.push('미국 관련 종목 평균 -3% 이하');
    const usPoints=usChange===null?null:Math.max(0,Math.min(20,10+usChange*2));
    const score=rating.value!==null&&usPoints!==null?Math.round(rating.value*.8+usPoints):null;
    if(score!==null&&score<60)reasons.push('장전 점수 60점 미만');
    report.assessments.push({symbol:item.symbol,name:item.name,score,domesticScore:rating.value,usChange,eligible:reasons.length===0,reasons,price:q?.price??null,priceAsOf:q?.asOf??null,flow:item.flow??null,leaders:ready?leaders.map(i=>({symbol:i.symbol,change:i.quote.change,asOf:i.quote.asOf})):[],factors:rating.parts});
  }
  report.candidates=report.assessments.filter(i=>i.eligible).sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol)).slice(0,3).map((i,n)=>({...i,rank:n+1}));
  report.status='ready';report.message=report.candidates.length?`장전 추천 ${report.candidates.length}개 · 국내 관찰점수 80% + 미국 관련 종목 강도 20%`:'오늘은 조건을 충족한 장전 추천 종목이 없습니다.';
  return report;
}
