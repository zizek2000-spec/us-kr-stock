// Versioned, deterministic policy. Ranking is not a probability of profit.
export const POLICY = Object.freeze({version:'verified-v1',minTrades:30,minSymbols:10,minDays:90,maxPicks:5,eventDays:7,stopPct:0.05,targetPct:0.10,holdSessions:10,costBps:20});
const DAY=86400000;
export const stamp=v=>typeof v==='string'&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(v)?Date.parse(v):NaN;
export function safeUrl(v){try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}}
export function evidenceProblems(e,now){
 const p=[];const pub=stamp(e.publishedAt),seen=stamp(e.observedAt),date=Date.parse(e.occurredAt);
 if(!e.id||!e.symbol||!['insider','politician','option'].includes(e.kind)||e.verified!==true)p.push('원문 대조 미완료');
 if(!safeUrl(e.sourceUrl)||!e.source)p.push('출처 미확인');
 if(!Number.isFinite(pub)||!Number.isFinite(seen)||!Number.isFinite(date)||pub>now||seen>now||date>pub||seen<pub)p.push('발생·공개·최초수집 시각 미확인 또는 역전');
 if(now-pub>POLICY.eventDays*DAY)p.push('공개 후 7일 초과');
 if(e.market!=='US')p.push('미국 신호의 한국 종목 자동 대입 금지');
 if(e.amended||e.footnoteUnresolved||e.planned)p.push('정정·주석·계획매매 검토 필요');
 if(e.kind==='insider'&&(e.code!=='P'||e.direction!=='A'||e.securityType!=='nonDerivative'||!(e.amountUSD>0)||!e.actorId))p.push('비파생증권 실제 매수 미확인');
 if(e.kind==='politician'&&(e.direction!=='buy'||!e.actorId||!e.owner||!(e.amountMinUSD>0)||e.amountMaxUSD<e.amountMinUSD||e.securityType!=='stock'))p.push('정치인 매수·소유자·금액구간 미확인');
 if(e.kind==='option'&&(!(e.premiumUSD>=1000000)||e.optionType!=='call'||e.aggressor!=='buy'||e.opening!==true||e.multiLeg!==false||e.directionVerified!==true||!(e.volume>e.openInterest)||!(e.volume>=3*e.averageVolume20)||!(e.averageVolume20>0)||e.licensed!==true))p.push('100만달러·신규 콜매수·이상거래·이용권한 검증 미충족');
 return p;
}
export function assessSymbol(symbol,events,quote,now){
 const accepted=events.filter(e=>e.symbol===symbol&&!evidenceProblems(e,now).length);
 const actors=new Set(accepted.filter(e=>e.kind!=='option').map(e=>e.actorId));
 const kinds=new Set(accepted.map(e=>e.kind));const reasons=[];
 if(!accepted.length)reasons.push('검증된 최근 매수 근거 없음');
 if(actors.size<2&&kinds.size<2)reasons.push('독립된 매수자 2명 또는 신호 유형 2개 필요');
 const q=quote;
 if(!q||!Number.isFinite(q.close)||q.close<=0||!Number.isFinite(q.ma20)||q.ma20<=0||!Number.isFinite(q.averageDollarVolume20)||q.averageDollarVolume20<10000000||q.completed!==true||!Number.isFinite(stamp(q.asOf))||stamp(q.asOf)>now||now-stamp(q.asOf)>4*DAY||!safeUrl(q.sourceUrl))reasons.push('완료 종가·20일 추세·일평균 1000만달러 유동성 미확인');
 else if(q.close<q.ma20)reasons.push('20일 평균 아래');
 if(q&&accepted.some(e=>Date.parse(q.asOf)<Math.max(stamp(e.publishedAt),stamp(e.observedAt))))reasons.push('공시 확인 이후 완료 시세 필요');
 return {symbol,eligible:!reasons.length,reasons,evidence:accepted,score:Math.min(100,actors.size*20+kinds.size*15+accepted.filter(e=>e.kind==='option').length*5),quote:q||null};
}
// Conservative expiry at the next weekday 09:30 New York. A holiday expires
// early rather than leaving a signal actionable through an unverified session.
export function nextOpen(now){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const get=k=>Number(parts.find(p=>p.type===k).value);
 let day=Date.UTC(get('year'),get('month')-1,get('day'));
 for(let i=0;i<8;i++,day+=86400000){if([0,6].includes(new Date(day).getUTCDay()))continue;let utc=day+14.5*3600000;
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hourCycle:'h23'}).format(utc));utc+=(9-hour)*3600000;
 if(utc>now)return new Date(utc).toISOString();}
 return new Date(now).toISOString();
}
export function makeReport({events=[],quotes={},backtest,coverage={},slot='manual',now=Date.now()}){
 const assessments=[...new Set(events.map(e=>e.symbol))].filter(Boolean).sort().map(s=>assessSymbol(s,events,quotes[s],now));
 const bt=backtest||{status:'insufficient',trades:0,message:'공개 시점이 검증된 과거 신호·가격 표본 없음'};
 const blockers=[];
 if(bt.status!=='passed'||bt.policyVersion!==POLICY.version||bt.trades<POLICY.minTrades||bt.symbols<POLICY.minSymbols||bt.spanDays<POLICY.minDays||!(bt.averageNetReturn>0)||!(bt.averageExcessReturn>0)||!Number.isFinite(stamp(bt.asOf))||stamp(bt.asOf)>now||now-stamp(bt.asOf)>7*DAY)blockers.push('백테스트 검증 미통과');
 if(coverage.insider?.status!=='ok')blockers.push('내부자 수집 상태 불완전');
 const eligible=assessments.filter(a=>a.eligible).sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol));
 const picks=blockers.length?[]:eligible.slice(0,POLICY.maxPicks).map((a,i)=>({...a,rank:i+1,entry:{min:a.quote.close,max:a.quote.close*1.02,rule:'다음 정규장 시가가 기준 종가~+2% 범위일 때만 진입. 그 밖에는 철회; 장중 재진입 없음.',currency:'USD'},exit:{stopPct:POLICY.stopPct,targetPct:POLICY.targetPct,holdSessions:POLICY.holdSessions,rule:'실제 체결가 대비 -5% 손절 / +10% 익절 / 10거래일 종료. 갭 발생 시 손절가 보장 안 됨.'},withdraw:'정정 공시·신호 오류·거래정지·가격 범위 이탈 시 철회. 다음 정규장 개장 후 미체결 조건은 만료.'}));
 return {version:POLICY.version,generatedAt:new Date(now).toISOString(),expiresAt:nextOpen(now),slot,status:picks.length?'ready':'withheld',message:picks.length?`검증 후보 ${picks.length}개 (최대 5개, 수량 채우기 없음)`:'추천 보류 — 검증 요건을 충족한 후보가 없습니다.',blockers,candidates:picks,assessments,excludedEvidence:events.map(e=>({id:e.id,symbol:e.symbol,reasons:evidenceProblems(e,now)})).filter(e=>e.reasons.length),backtest:bt,coverage,policy:POLICY,scope:'미국 주식 직접 신호만 평가. 한국장 개장 전에도 미국 후보를 재검증하며, 한국 종목 추천에는 별도 국내 직접 근거와 검증이 필요합니다.'};
}
