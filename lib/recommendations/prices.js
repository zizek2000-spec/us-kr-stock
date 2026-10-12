// Yahoo chart remains an explicitly unofficial delayed source, as in the old app.
export async function prices(symbol,fetcher=fetch){
 const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d&events=div%2Csplits`;
 const r=await fetcher(url,{headers:{'User-Agent':'MarketRadar/1.0'},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Price provider unavailable');
 const raw=await r.json(),c=raw?.chart?.result?.[0],q=c?.indicators?.quote?.[0],m=c?.meta;
 if(!q||m?.exchangeTimezoneName!=='America/New_York'||m?.currency!=='USD')throw Error('Unsupported exchange');
 // Only capture the actual current regular-session clocks supplied by the source.
 // Earlier daily bars are for trend calculation, never invented backtest clocks.
 const bars=(c.timestamp||[]).map((t,i)=>({t,close:q.close?.[i],volume:q.volume?.[i]})).filter(b=>Number.isFinite(b.close)&&b.close>0&&Number.isFinite(b.volume));
 const end=m.currentTradingPeriod?.regular?.end,completed=Number.isFinite(end)&&Date.now()>=end*1000;
 const history=bars.filter(b=>b.t*1000<new Date(new Date(m.regularMarketTime*1000).toISOString().slice(0,10)).getTime()).slice(-20);
 const start=m.currentTradingPeriod?.regular?.start;
 const i=(c.timestamp||[]).findIndex(t=>t===start);
 const actions=[...Object.values(c.events?.splits||{}),...Object.values(c.events?.dividends||{})];
 const bar=completed&&i>=0?{openAt:new Date(start*1000).toISOString(),closeAt:new Date(end*1000).toISOString(),open:q.open[i],high:q.high[i],low:q.low[i],close:q.close[i],corporateAction:actions.some(a=>Math.abs(a.date-start)<86400),sourceUrl:`https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/history/`,observedAt:new Date().toISOString()}:null;
 return {bar,close:m.regularMarketPrice,asOf:new Date(m.regularMarketTime*1000).toISOString(),completed,ma20:history.length===20?history.reduce((s,b)=>s+b.close,0)/20:null,averageDollarVolume20:history.length===20?history.reduce((s,b)=>s+b.close*b.volume,0)/20:null,source:'Yahoo Finance (비공식·지연 가능)',sourceUrl:`https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/`};
}
