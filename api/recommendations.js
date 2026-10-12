import {readFile} from 'node:fs/promises';
export function currentReport(report,now=Date.now()){
 if(!report||report.version!=='verified-v1'||!Array.isArray(report.candidates)||!Number.isFinite(Date.parse(report.generatedAt))||Date.parse(report.generatedAt)>now)return {version:'verified-v1',status:'withheld',candidates:[],blockers:['아직 검증 보고서가 생성되지 않았습니다.'],message:'추천 보류',backtest:{status:'insufficient',trades:0},coverage:{},telegram:{status:'unknown'}};
 if(!Number.isFinite(Date.parse(report.expiresAt))||Date.parse(report.expiresAt)<=now)return {...report,status:'expired',candidates:[],archivedCandidateCount:report.candidates.length,message:'추천 보류 — 보고서 유효시간 만료',blockers:[...(report.blockers||[]),'다음 예약 수집 결과 필요']};
 return report;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');if(req.method!=='GET')return res.status(405).json({error:'GET only'});
 let remote=null,local=null;
 try{local=JSON.parse(await readFile(new URL('../public/data/recommendations.json',import.meta.url),'utf8'))}catch{}
 try{const r=await fetch('https://raw.githubusercontent.com/zizek2000-spec/us-kr-stock/main/public/data/recommendations.json',{signal:AbortSignal.timeout(7000)});if(r.ok)remote=await r.json()}catch{}
 const report=!local||Date.parse(remote?.generatedAt)>Date.parse(local.generatedAt)?remote:local;
 return res.status(200).json(currentReport(report));
}
