// InvestStart: сервер без внешних зависимостей (Node.js 18+)
const fs=require('fs'),path=require('path'),http=require('http');
(()=>{try{for(const l of fs.readFileSync(path.join(__dirname,'..','.env'),'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}}catch{}})();
const {load,save,flush}=require('./lib');
const M=require('./market'),N=require('./news'),AI=require('./ai');
const PUB=path.join(__dirname,'..','public'),PORT=+process.env.PORT||3000,DAY=864e5;
const CAT={macro:'Ставки',commodities:'Сырьё',fx:'Валюта',world:'Мир',crypto:'Крипто',stocks:'Акции',funds:'Фонды',bonds:'Облигации',metals:'Золото',foreign:'Акции',other:'Рынок'};
const NOTE={macro:'Решения по ставке и инфляция сильнее всего влияют на облигации и банки. Это повод проверить долю облигаций.',commodities:'Цены на нефть заметно двигают нефтегазовые компании и индекс Мосбиржи.',fx:'Курс рубля меняет рублёвую стоимость валютных активов: крипты и иностранных акций.',world:'Мировые рынки задают настроение и для рискованных активов, включая крипту.',crypto:'Крипта реагирует на новости резко. Держите её долю в пределах своего лимита риска.',other:'Отдельная новость редко меняет долгосрочную картину. Смотрите на структуру портфеля в целом.'};
const DEF={BTC:.035,ETH:.6,SBER:600,YDEX:30,GAZP:0,LKOH:0,AAPL:8,GOLD:20,OFZ:150,TMOS:15000,RUB:60000};
const pf=load('portfolio',null)||Object.fromEntries(Object.entries(DEF).map(([t,q])=>[t,{q}]));save('portfolio',pf);

function formatNews(list,notes={}){
  const end=Math.floor(Date.now()/DAY)*DAY;
  return list.map(n=>({
    id:n.id,
    d:Math.max(0,Math.round((end-Math.floor(n.t/DAY)*DAY)/DAY)),
    cat:CAT[n.cat]||'Рынок',
    t:n.title,
    x:n.desc,
    link:/^https?:/.test(n.link)?n.link:'',
    src:n.source,
    im:Object.fromEntries(n.tickers.map(t=>[t,0])),
    ai:notes[n.id]||NOTE[n.cat]||NOTE[{stocks:'other',funds:'other',bonds:'macro',metals:'other',foreign:'world'}[n.cat]]||NOTE.other
  }));
}

let bcache=null,bt=0,bp=null;
async function bundle(){
  if(bcache&&Date.now()-bt<15e3)return bcache;
  if(bp)return bp;
  bp=(async()=>{
    const q=(await M.quotes()).quotes,end=Math.floor(Date.now()/DAY)*DAY,days=[...Array(365)].map((_,i)=>end-(364-i)*DAY);
    const assets={};let changed=false;
    const allTickers=[...new Set([...Object.keys(pf),...M.ASSETS.map(a=>a.t)])];
    await Promise.all(allTickers.map(async t=>{
      const qHold=pf[t]?pf[t].q:0;
      let h=[];if(t==='RUB'){assets.RUB={p:1,q:qHold,avg:1,ch:0,h:days.map(()=>1)};return}
      try{h=await M.history(t)}catch(e){console.warn('history',t,e.message)}
      const p=q[t]?.price||(h.length?h[h.length-1][1]:null);if(!p)return;
      let j=0,v=h.length?h[0][1]:p;
      const s=days.map(d=>{while(j<h.length&&h[j][0]<d+DAY){v=h[j][1];j++}return v});s[s.length-1]=p;
      const defAvg=+s[s.length-121].toFixed(4);
      if(pf[t]&&!pf[t].avg){pf[t].avg=defAvg;changed=true}
      assets[t]={p,q:qHold,avg:pf[t]?.avg||defAvg,ch:q[t]?.change!=null?q[t].change/100:null,h:s.map(x=>+x.toFixed(4)),n:M.byT(t)?.name};
    }));
    if(changed)save('portfolio',pf);
    let news=[];try{news=(await N.allNews()).slice(0,40)}catch(e){console.warn('news',e.message)}
    let notes={};if(AI.enabled())notes=await AI.notes(news.slice(0,15)).catch(e=>(console.warn(e.message),{}));
    const nl=formatNews(news,notes);
    const heldAssets=Object.entries(assets).filter(([,a])=>a.q>0);
    const tot=heldAssets.reduce((s,[,a])=>s+a.p*a.q,0)||1;
    const ctx={portfolio_rub:Math.round(tot),assets:heldAssets.map(([t,a])=>({t,share:+(a.p*a.q/tot*100).toFixed(1),ch30d:+((a.h[364]/a.h[334]-1)*100).toFixed(1),pnl:+((a.p/a.avg-1)*100).toFixed(1)})),news:nl.slice(0,8).map(n=>n.t)};
    let tips=[];if(AI.enabled())tips=await AI.tips(ctx).catch(e=>(console.warn(e.message),[]));
    bcache={days,assets,news:nl,tips,ctx,ai:AI.enabled(),t:Date.now()};bt=Date.now();return bcache;
  })().finally(()=>bp=null);
  return bp;
}

const clients=new Set();
let lastNewsKey='';
async function broadcastTick(){
  if(!clients.size)return;
  try{
    const q=await M.quotes();
    let newsPayload=null;
    const rawNews=await N.allNews().catch(()=>null);
    if(rawNews&&rawNews.length){
      const key=rawNews.slice(0,5).map(n=>n.id).join(',');
      if(key!==lastNewsKey){
        lastNewsKey=key;
        let notes={};
        if(AI.enabled())notes=await AI.notes(rawNews.slice(0,15)).catch(()=>({}));
        newsPayload=formatNews(rawNews.slice(0,40),notes);
      }
    }
    const msg='data: '+JSON.stringify({t:q.t,usd:q.usd,quotes:q.quotes,news:newsPayload})+'\n\n';
    for(const res of clients){
      try{res.write(msg)}catch{clients.delete(res)}
    }
  }catch(e){console.warn('stream tick:',e.message)}
}
setInterval(broadcastTick,5e3).unref();

function cleanCtx(c,base){if(!c||!Array.isArray(c.assets)||!c.assets.length)return null;
  return {portfolio_rub:Math.round(+c.portfolio_rub||0),assets:c.assets.slice(0,30).map(a=>({t:String(a.t||'').slice(0,12),name:String(a.name||'').slice(0,40),share:+a.share||0,ch30d:+a.ch30d||0,pnl:+a.pnl||0})),news:base.news,source:'портфель пользователя'}}
const hits=new Map();
function limited(ip){const now=Date.now(),a=(hits.get(ip)||[]).filter(t=>now-t<60e3);a.push(now);hits.set(ip,a);return a.length>(+process.env.AI_RATE_PER_MIN||8)}
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png'};
function send(res,code,obj){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj))}
function body(req){return new Promise((ok,no)=>{let b='';req.on('data',c=>{b+=c;if(b.length>2e4){no(new Error('big'));req.destroy()}});req.on('end',()=>{try{ok(JSON.parse(b||'{}'))}catch(e){no(e)}})})}
const srv=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','SAMEORIGIN');
  const u=new URL(req.url,'http://x');
  try{
    if(u.pathname==='/api/stream'){
      res.writeHead(200,{
        'Content-Type':'text/event-stream; charset=utf-8',
        'Cache-Control':'no-cache, no-transform',
        'Connection':'keep-alive'
      });
      res.write(': connected\n\n');
      clients.add(res);
      broadcastTick();
      req.on('close',()=>clients.delete(res));
      return;
    }
    if(u.pathname==='/api/bundle')return send(res,200,await bundle());
    if(u.pathname==='/api/quotes')return send(res,200,await M.quotes());
    if(u.pathname==='/api/news')return send(res,200,(await bundle()).news);
    if(u.pathname==='/api/health')return send(res,200,{ok:true,ai:AI.enabled(),model:AI.enabled()?AI.MODEL:null});
    if(u.pathname==='/api/ai/chat'&&req.method==='POST'){
      if(!AI.enabled())return send(res,503,{error:'AI не настроен'});
      if(limited(req.socket.remoteAddress))return send(res,429,{error:'Слишком много запросов'});
      const b=await body(req),q=String(b.q||'').trim().slice(0,800);if(!q)return send(res,400,{error:'Пустой вопрос'});
      const bc=(await bundle()).ctx;return send(res,200,{answer:await AI.answer(q,b.history,cleanCtx(b.ctx,bc)||bc)});
    }
    if(u.pathname==='/api/ai/tips'&&req.method==='POST'){
      if(!AI.enabled())return send(res,503,{error:'AI не настроен'});
      if(limited(req.socket.remoteAddress))return send(res,429,{error:'Слишком много запросов'});
      const ctx=cleanCtx((await body(req)).ctx,(await bundle()).ctx);if(!ctx)return send(res,400,{error:'Нет портфеля'});
      return send(res,200,{tips:await AI.tips(ctx)});
    }
    if(u.pathname.startsWith('/api/'))return send(res,404,{error:'Нет такого метода'});
    let f=path.normalize(path.join(PUB,decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname)));
    if(!f.startsWith(PUB+path.sep))return send(res,403,{error:'forbidden'});
    fs.readFile(f,(e,d)=>{if(e){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Не найдено')}
      res.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream','Cache-Control':'public, max-age=300'});res.end(d)});
  }catch(e){console.error(u.pathname,e.message);send(res,e.code===400?400:502,{error:'Источник данных недоступен'})}
});
srv.listen(PORT,()=>{console.log(`InvestStart: http://localhost:${PORT}  AI: ${AI.enabled()?AI.MODEL:'выключен (нет AI_API_KEY)'}`);M.startCollector();bundle().catch(e=>console.warn('прогрев:',e.message))});
for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>{flush();process.exit(0)});
