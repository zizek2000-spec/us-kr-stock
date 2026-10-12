import {POLICY,assessSymbol,stamp} from './engine.js';
const DAY=86400000;
// Replay saved point-in-time collection snapshots; never backdate observedAt.
// Conservative daily OHLC: if both barriers hit, stop wins. Gap exit at open.
export function backtest({snapshots=[],bars={},benchmark=[],now=Date.now()}){
 const trades=[],busy=new Map();let rejected=0;
 const chronological=[...snapshots].filter(s=>stamp(s.generatedAt)<=now).sort((a,b)=>stamp(a.generatedAt)-stamp(b.generatedAt));
 for(const s of chronological){
  const at=stamp(s.generatedAt);
  if(s.policyVersion!==POLICY.version||s.coverage?.insider?.status!=='ok'){rejected++;continue}
  const candidates=[...new Set((s.events||[]).map(e=>e.symbol))].map(symbol=>assessSymbol(symbol,s.events,s.quotes?.[symbol],at)).filter(x=>x.eligible).sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol)).slice(0,POLICY.maxPicks);
  for(const c of candidates){
   if((busy.get(c.symbol)||0)>=at)continue;
   const future=(bars[c.symbol]||[]).filter(b=>stamp(b.openAt)>at&&stamp(b.closeAt)<=now).sort((a,b)=>stamp(a.openAt)-stamp(b.openAt));
   if(future.length<POLICY.holdSessions){rejected++;continue}
   const window=future.slice(0,POLICY.holdSessions);
   const marketSessions=benchmark.filter(b=>stamp(b.openAt)>at&&stamp(b.closeAt)<=now).sort((a,b)=>stamp(a.openAt)-stamp(b.openAt)).slice(0,POLICY.holdSessions);
   if(marketSessions.length!==window.length||window.some((b,i)=>b.openAt!==marketSessions[i].openAt||b.corporateAction||marketSessions[i].corporateAction)){rejected++;continue}
   if(window.some(b=>![b.open,b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0)||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)||!(stamp(b.closeAt)>stamp(b.openAt)))){rejected++;continue}
   const entry=window[0].open;
   if(entry<c.quote.close||entry>c.quote.close*1.02)continue;
   const stop=entry*(1-POLICY.stopPct),target=entry*(1+POLICY.targetPct);let last=window.at(-1),exit=last.close,reason='time';
   for(const b of window){if(b.open<=stop){last=b;exit=b.open;reason='gap-stop';break}if(b.open>=target){last=b;exit=b.open;reason='gap-target';break}if(b.low<=stop){last=b;exit=stop;reason='stop';break}if(b.high>=target){last=b;exit=target;reason='target';break}}
   const startBenchmark=benchmark.find(b=>b.openAt===window[0].openAt),endBenchmark=benchmark.find(b=>b.closeAt===last.closeAt);
   if(!(startBenchmark?.open>0)||!(endBenchmark?.close>0)){rejected++;continue}
   const net=exit/entry-1-POLICY.costBps/10000,bench=endBenchmark.close/startBenchmark.open-1;
   trades.push({symbol:c.symbol,signalAt:s.generatedAt,entryAt:window[0].openAt,exitAt:last.closeAt,entry,exit,netReturn:net,excessReturn:net-bench,reason});busy.set(c.symbol,stamp(last.closeAt));
  }
 }
 const n=trades.length,symbols=new Set(trades.map(t=>t.symbol)).size,spanDays=chronological.length>1?(stamp(chronological.at(-1).generatedAt)-stamp(chronological[0].generatedAt))/DAY:0;
 const mean=k=>n?trades.reduce((s,t)=>s+t[k],0)/n:null;const avg=mean('netReturn'),excess=mean('excessReturn');
 const sufficient=n>=POLICY.minTrades&&symbols>=POLICY.minSymbols&&spanDays>=POLICY.minDays;
 return {policyVersion:POLICY.version,asOf:new Date(now).toISOString(),status:!sufficient?'insufficient':avg>0&&excess>0?'passed':'failed',trades:n,symbols,spanDays:Math.floor(spanDays),averageNetReturn:avg,averageExcessReturn:excess,winRate:n?trades.filter(t=>t.netReturn>0).length/n:null,worstTrade:n?Math.min(...trades.map(t=>t.netReturn)):null,rejected,costBps:POLICY.costBps,results:trades,message:!sufficient?'최소 30건·10종목·90일의 전향 수집 표본 필요':'고정 규칙의 수집 이후 재현 결과. 통계적 유의성·향후 수익 보장 아님.',limitations:['신규 구축 전향 표본만 사용; 과거 실적을 소급 생성하지 않음','OHLC로 장중 순서 확인 불가: 손절 우선','왕복 비용 20bp 가정; 공매도·레버리지 없음','거래별 수익률 평균이며 동시 포지션을 반영한 포트폴리오 수익률·MDD 아님','Yahoo 비공식 일봉을 전향 수집; 분할·배당 발생 보유구간은 제외, 결측 거래일은 SPY와 대조']};
}
