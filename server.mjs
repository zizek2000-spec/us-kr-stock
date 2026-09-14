import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const allowed=new Set(['index.html','style.css','app.js','engine.js','favicon.svg']);
createServer(async(req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!allowed.has(name)){res.writeHead(404).end();return;}try{const content=await readFile(`public/${name}`);res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css':name.endsWith('.svg')?'image/svg+xml':'text/javascript');res.end(content);}catch{res.writeHead(500).end();}}).listen(4173,'127.0.0.1',()=>console.log('http://localhost:4173'));
