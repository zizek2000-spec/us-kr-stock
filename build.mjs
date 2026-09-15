import {mkdir,copyFile,cp} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const file of ['index.html','style.css','app.js','engine.js','scoring.js','favicon.svg']) await copyFile(`public/${file}`,`dist/${file}`);
console.log('Built Market Radar');
try{await cp('public/data','dist/data',{recursive:true})}catch(e){if(e.code!=='ENOENT')throw e}
