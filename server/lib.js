// Общие утилиты: хранилище JSON, кэш, HTTP-запросы
const fs=require('fs'),path=require('path');
const DATA=path.resolve(process.env.DATA_DIR||path.join(__dirname,'..','data'));
fs.mkdirSync(DATA,{recursive:true});
const latest={},timers={};
const file=n=>path.join(DATA,n+'.json');
function load(n,def){try{return JSON.parse(fs.readFileSync(file(n),'utf8'))}catch{return def}}
function write(n){const f=file(n);fs.writeFileSync(f+'.tmp',JSON.stringify(latest[n]));fs.renameSync(f+'.tmp',f)}
function save(n,obj){latest[n]=obj;clearTimeout(timers[n]);timers[n]=setTimeout(()=>{try{write(n)}catch(e){console.error('save',n,e.message)}},400)}
function flush(){for(const n in latest){clearTimeout(timers[n]);try{write(n)}catch(e){console.error('flush',n,e.message)}}}

const cache=new Map(),pending=new Map();
async function cached(key,ttl,fn){
  const c=cache.get(key);
  if(c&&Date.now()-c.t<ttl)return c.v;
  if(pending.has(key))return pending.get(key);
  const p=(async()=>{
    try{const v=await fn();cache.set(key,{t:Date.now(),v});return v}
    catch(e){if(c){console.warn('[stale]',key,e.message);return c.v}throw e}
    finally{pending.delete(key)}
  })();
  pending.set(key,p);return p;
}
const UA={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36','Accept':'*/*'};
async function req(url,opt={}){
  const r=await fetch(url,{...opt,headers:{...UA,...(opt.headers||{})},signal:AbortSignal.timeout(opt.timeout||12000)});
  if(!r.ok)throw new Error(new URL(url).hostname+' HTTP '+r.status);
  return r;
}
function decode(buf){
  const head=Buffer.from(buf.subarray(0,300)).toString('latin1');
  const m=head.match(/encoding=["']([\w-]+)["']/i);
  try{return new TextDecoder(m?m[1].toLowerCase():'utf-8').decode(buf)}catch{return new TextDecoder().decode(buf)}
}
const getJSON=async(u,o)=>(await req(u,o)).json();
const getBuf=async(u,o)=>new Uint8Array(await (await req(u,o)).arrayBuffer());
const getText=async(u,o)=>decode(await getBuf(u,o));
module.exports={DATA,load,save,flush,cached,getJSON,getBuf,getText,decode};
