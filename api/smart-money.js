// Public-source monitoring; no claims of execution-time or live options coverage.
const FEED='https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&owner=only&count=40&output=atom';
const SOURCE='https://www.sec.gov/edgar/search/';
function decode(s){return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/<[^>]*>/g,'').trim()}
function field(xml,tag){return decode(xml.match(new RegExp('<(?:\\w+:)?'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?'+tag+'>','i'))?.[1]||'')}
export function parseEntries(xml){
 const chunks=xml.match(/<entry\b[^>]*>[\s\S]*?<\/entry>/gi)||[];
 return chunks.slice(0,40).map(v=>({id:field(v,'id'),title:field(v,'title'),published:field(v,'updated')||field(v,'published'),url:v.match(/<link\b[^>]*href="([^"]+)"/i)?.[1]?.replace(/&amp;/g,'&')||SOURCE,form:'4',source:'SEC EDGAR'})).filter(v=>v.id&&v.title);
}
export async function fetchInsiders(){
 const agent=process.env.SEC_USER_AGENT;
 if(!agent)return {status:'not_configured',items:[],message:'SEC_USER_AGENT(운영자 연락 이메일 포함)을 서버 환경변수에 설정해야 합니다.'};
 try{
  const r=await fetch(FEED,{headers:{'User-Agent':agent,'Accept':'application/atom+xml,application/xml'},signal:AbortSignal.timeout(9000)});
  if(!r.ok)throw new Error('SEC HTTP '+r.status);
  return {status:'ok',items:parseEntries(await r.text()),asOf:new Date().toISOString(),message:'SEC Form 4 제출 목록입니다. 거래 방향·금액·종목은 원문 확인 전까지 판정하지 않습니다.'};
 }catch(e){return {status:'unavailable',items:[],message:'SEC 조회 실패: '+String(e.message).slice(0,90)}}
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=300');
 const insiders=await fetchInsiders();
 res.status(200).json({generatedAt:new Date().toISOString(),insiders,
 politicians:{status:'source_link_only',items:[],message:'공식 하원 거래공시를 조회하세요. 자동 추출/실시간 모니터링은 아직 미연결입니다.',source:'https://disclosures-clerk.house.gov/FinancialDisclosure'},
 options:{status:'requires_licensed_data',items:[],premiumThresholdUSD:1000000,message:'검증된 옵션 체결 데이터 공급 계약/키가 없어 경보를 생성하지 않습니다. 옵션 100만달러 기준은 향후 적용 예정입니다.'},
 notice:'공시 제출 시각과 실제 거래 시각은 다릅니다. 정보 지연 및 미수집 가능. 매수 권유 아님.'});
}
