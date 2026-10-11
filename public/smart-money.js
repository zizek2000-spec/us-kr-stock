const status=document.querySelector('#status'),list=document.querySelector('#insiders');
function el(tag,text){const n=document.createElement(tag);n.textContent=text;return n}
async function load(){
 status.textContent='SEC 자료 확인 중…';list.replaceChildren();
 try{const r=await fetch('/api/smart-money',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();
 status.textContent=d.insiders.message+(d.insiders.asOf?' 조회 시각: '+new Date(d.insiders.asOf).toLocaleString('ko-KR'):'');
 if(!d.insiders.items.length){list.append(el('p','현재 표시 가능한 검증 데이터가 없습니다.'));return}
 for(const item of d.insiders.items){const row=el('article','');row.className='item';const a=el('a',item.title);try{const url=new URL(item.url);if(url.protocol==='https:'&&url.hostname.endsWith('sec.gov')){a.href=url.href;a.target='_blank';a.rel='noopener noreferrer'}}catch{}row.append(a,el('p','제출 업데이트: '+(item.published||'미확인')+' · SEC Form 4'));list.append(row)}
 }catch(e){status.textContent='조회 오류: '+e.message}
}
document.querySelector('#reload').addEventListener('click',load);load();
