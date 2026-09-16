import {getMarketData} from './market.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  if(!process.env.CRON_SECRET||req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({error:'Unauthorized'});
  try{const data=await getMarketData();const report=data.morning;return res.status(report?.status==='waiting'?503:200).json({status:report?.status,targetDate:report?.targetDate,count:report?.candidates?.length??0,generatedAt:report?.generatedAt})}catch{return res.status(503).json({error:'Morning collection failed'})}
}
