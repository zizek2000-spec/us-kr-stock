export function telegramText(report){
 const lines=[`[Market Radar] ${report.slot} · ${report.generatedAt}`,report.message];
 if(!report.candidates.length)lines.push(...report.blockers,`백테스트: ${report.backtest.status} / ${report.backtest.trades}건`);
 for(const c of report.candidates){lines.push(`\n${c.rank}. ${c.symbol} · 근거점수 ${c.score}`,`진입: $${c.entry.min.toFixed(2)}~$${c.entry.max.toFixed(2)} (다음 정규장 시가만)`,`손절 -5% / 익절 +10% / 최대 10거래일`,c.withdraw);for(const e of c.evidence.slice(0,3))lines.push(`${e.kind}: ${e.actor||'옵션 신규 콜매수'} / 발생 ${e.occurredAt} / 공개 ${e.publishedAt}`,e.sourceUrl)}
 lines.push('전체 근거·검증 상태: https://us-kr-market-radar.vercel.app/recommendations.html','자동 주문 없음. 공개자료 지연·손실 가능.');return lines.join('\n');
}
export async function sendTelegram(report,{token=process.env.TELEGRAM_BOT_TOKEN,chatId=process.env.TELEGRAM_CHAT_ID,fetcher=fetch}={}){
 if(!token||!chatId)return {status:'not_configured',message:'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 미설정'};
 const full=telegramText(report);const chunks=[];let chunk='';for(const line of full.split('\n')){if((chunk+'\n'+line).length>3500){chunks.push(chunk);chunk=''}chunk+=(chunk?'\n':'')+line}if(chunk)chunks.push(chunk);
 const ids=[];
 for(const text of chunks){try{const r=await fetcher(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text,disable_web_page_preview:true}),signal:AbortSignal.timeout(12000)});const body=await r.json();if(!r.ok||body.ok!==true||!Number.isFinite(body.result?.message_id))return {status:'failed',message:'Telegram API가 발송을 확인하지 못했습니다.',sentParts:ids.length};ids.push(body.result.message_id)}catch{return {status:'failed',message:'Telegram 전송 오류. 비밀키와 요청 URL은 로그에 기록하지 않습니다.',sentParts:ids.length}}}
 return {status:'sent',sentAt:new Date().toISOString(),parts:ids.length};
}
