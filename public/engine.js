export const weights={KR:[25,15,15,15,10,5,10,5],US:[25,15,10,15,10,10,10,5]};
export const labels={KR:['사업·공급망 연관','미국 관련주 움직임','60일 선행 상관도','신규 이벤트','국내 미반영 정도','매크로 환경','거래대금·수급','기술적 위치'],US:['신규 이벤트','프리마켓 가격','프리마켓 거래량','옵션 변화','애널리스트 추정','업종·동종주','매크로 환경','기술적 위치']};
export function score(market,values){const w=weights[market];if(!w||values.length!==w.length||values.some((v,i)=>!Number.isFinite(v)||v<0||v>w[i]))return null;return values.reduce((a,b)=>a+b,0);}
export function decision(points,{expired=false,invalid=false}={}){if(expired||points===null)return 'WATCH';if(invalid)return 'AVOID';return points>=75?'BUY':'WATCH';}
export function riskDecision(points){return points>70?'EXIT':points>=50?'REDUCE':'KEEP';}
