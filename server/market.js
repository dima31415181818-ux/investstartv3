// Рыночные данные: MOEX ISS, Binance (резерв CoinGecko), Yahoo Finance, курс ЦБ РФ
const {cached,getJSON,getText,load,save}=require('./lib');
const S=(t,name,cls,b,x={})=>({t,name,cls,src:'moex',e:'stock',m:'shares',b,cur:'RUB',...x});
const ASSETS=[
  {t:'BTC',name:'Bitcoin',cls:'crypto',src:'crypto',sym:'BTCUSDT',cg:'bitcoin',cur:'USD'},
  {t:'ETH',name:'Ethereum',cls:'crypto',src:'crypto',sym:'ETHUSDT',cg:'ethereum',cur:'USD'},
  S('SBER','Сбербанк','stocks','TQBR'),
  S('YDEX','Яндекс','stocks','TQBR'),
  S('GAZP','Газпром','stocks','TQBR'),
  S('LKOH','Лукойл','stocks','TQBR'),
  S('TMOS','Фонд на индекс Мосбиржи','funds','TQTF'),
  S('OFZ','ОФЗ 26238','bonds','TQOB',{sec:'SU26238RMFS4',m:'bonds',bond:true}),
  {t:'GOLD',sec:'GLDRUB_TOM',name:'Золото, 1 грамм',cls:'metals',src:'moex',e:'currency',m:'selt',b:'CETS',cur:'RUB'},
  {t:'AAPL',name:'Apple',cls:'foreign',src:'yahoo',sym:'AAPL',cur:'USD'}
];
const byT=t=>ASSETS.find(a=>a.t===t);
const rows=b=>b&&b.data?b.data.map(r=>Object.fromEntries(b.columns.map((c,i)=>[c,r[i]]))):[];

const usd=()=>cached('usd',3600e3,async()=>{
  const j=await getJSON('https://www.cbr-xml-daily.ru/daily_json.js');
  return {v:j.Valute.USD.Value,prev:j.Valute.USD.Previous};
});
const pad=n=>String(n).padStart(2,'0');
const dmy=d=>pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear();
const usdHistory=()=>cached('usdh',6*3600e3,async()=>{
  let out=[];
  try{
    const xml=await getText(`https://www.cbr.ru/scripts/XML_dynamic.asp?date_req1=${dmy(new Date(Date.now()-380*864e5))}&date_req2=${dmy(new Date())}&VAL_NM_RQ=R01235`);
    for(const m of xml.matchAll(/Date="(\d\d)\.(\d\d)\.(\d{4})"[\s\S]*?<Value>([\d,.]+)<\/Value>/g))
      out.push([Date.UTC(+m[3],+m[2]-1,+m[1]),parseFloat(m[4].replace(',','.'))]);
  }catch(e){console.warn('CBR history:',e.message)}
  if(!out.length)out=[[0,(await usd()).v]];
  return out;
});
function rateAt(h,t){let v=h[0][1];for(const [ms,x] of h){if(ms<=t)v=x;else break}return v}

async function moexGroup(list){
  const a=list[0];
  const j=await getJSON(`https://iss.moex.com/iss/engines/${a.e}/markets/${a.m}/boards/${a.b}/securities.json?securities=${list.map(x=>x.sec||x.t).join(',')}&iss.meta=off&iss.only=securities,marketdata`);
  const Sx=rows(j.securities),Mx=rows(j.marketdata),out={};
  for(const x of list){
    const id=x.sec||x.t,s=Sx.find(r=>r.SECID===id)||{},m=Mx.find(r=>r.SECID===id)||{};
    const price=m.LAST||m.LCURRENTPRICE||m.MARKETPRICE||s.PREVPRICE||s.PREVWAPRICE;
    const prev=s.PREVPRICE||s.PREVWAPRICE||price;
    const k=x.bond?(s.FACEVALUE||1000)/100:1;
    if(price)out[x.t]={price:price*k,prev:prev*k};
  }
  return out;
}
async function binance(path){
  for(const b of ['https://data-api.binance.vision','https://api.binance.com']){try{return await getJSON(b+path)}catch(e){}}
  throw new Error('Binance недоступен');
}
async function cryptoQuotes(list){
  const o={};
  try{
    const j=await binance('/api/v3/ticker/24hr?symbols='+encodeURIComponent(JSON.stringify(list.map(x=>x.sym))));
    for(const x of list){const r=j.find(q=>q.symbol===x.sym);if(r)o[x.t]={price:+r.lastPrice,prev:+r.openPrice}}
  }catch(e){
    const j=await getJSON('https://api.coingecko.com/api/v3/simple/price?ids='+list.map(x=>x.cg).join(',')+'&vs_currencies=usd&include_24hr_change=true');
    for(const x of list){const r=j[x.cg];if(r)o[x.t]={price:r.usd,prev:r.usd/(1+(r.usd_24h_change||0)/100)}}
  }
  return o;
}
async function yahooQuote(x){
  const j=await getJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${x.sym}?range=1d&interval=1h`);
  const m=j.chart.result[0].meta;
  return {price:m.regularMarketPrice,prev:m.chartPreviousClose||m.previousClose};
}
const quotes=()=>cached('quotes',5e3,async()=>{
  const fx=await usd().catch(e=>{console.warn('USD:',e.message);return {v:null}});
  const groups={};
  for(const a of ASSETS.filter(a=>a.src==='moex')){const k=a.e+a.m+a.b;(groups[k]=groups[k]||[]).push(a)}
  const parts=await Promise.allSettled([
    ...Object.values(groups).map(moexGroup),
    cryptoQuotes(ASSETS.filter(a=>a.src==='crypto')),
    ...ASSETS.filter(a=>a.src==='yahoo').map(async a=>({[a.t]:await yahooQuote(a)}))
  ]);
  const raw={};
  parts.forEach(p=>{if(p.status==='fulfilled')Object.assign(raw,p.value);else console.warn('quote:',p.reason.message)});
  const out={};
  for(const a of ASSETS){
    const q=raw[a.t];if(!q)continue;
    const k=a.cur==='USD'?fx.v:1;if(!k)continue;
    out[a.t]={price:q.price*k,native:q.price,cur:a.cur,change:q.prev?(q.price/q.prev-1)*100:0};
  }
  out.RUB={price:1,native:1,cur:'RUB',change:0};
  return {t:Date.now(),usd:fx.v,quotes:out};
});

async function rawHistory(a){
  const from=new Date(Date.now()-372*864e5).toISOString().slice(0,10);
  if(a.src==='moex'){
    const j=await getJSON(`https://iss.moex.com/iss/engines/${a.e}/markets/${a.m}/boards/${a.b}/securities/${a.sec||a.t}/candles.json?from=${from}&interval=24&iss.meta=off`);
    const c=j.candles.columns,ci=c.indexOf('close'),bi=c.indexOf('begin'),k=a.bond?10:1;
    return j.candles.data.map(r=>[Date.parse(r[bi].replace(' ','T')+'+03:00'),r[ci]*k]);
  }
  if(a.src==='crypto'){
    try{const j=await binance(`/api/v3/klines?symbol=${a.sym}&interval=1d&limit=370`);return j.map(r=>[r[0],+r[4]])}
    catch(e){const j=await getJSON(`https://api.coingecko.com/api/v3/coins/${a.cg}/market_chart?vs_currency=usd&days=365&interval=daily`);return j.prices}
  }
  const j=await getJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${a.sym}?range=1y&interval=1d`);
  const r=j.chart.result[0],c=r.indicators.quote[0].close;
  return r.timestamp.map((t,i)=>[t*1000,c[i]]).filter(p=>p[1]!=null);
}
function history(t){
  const a=byT(t);if(!a){const e=new Error('Неизвестный актив');e.code=400;return Promise.reject(e)}
  return cached('h:'+t,3600e3,async()=>{
    let h=await rawHistory(a);
    if(a.cur==='USD'){const fx=await usdHistory().catch(async()=>[[0,(await usd()).v]]);h=h.map(([ms,p])=>[ms,p*rateAt(fx,ms)])}
    return h;
  });
}
const DAYS={'1w':7,'1m':31,'3m':92,'6m':183,'1y':366};
function slice(h,range,cur){
  const from=Date.now()-(DAYS[range]||31)*864e5,out=h.filter(p=>p[0]>=from);
  if(cur!=null)out.push([Date.now(),cur]);
  return out;
}
const stats=()=>cached('stats',6*3600e3,async()=>{
  const out={};
  await Promise.all(ASSETS.map(async a=>{
    try{
      const h=await history(a.t),r=[];
      for(let i=1;i<h.length;i++)if(h[i-1][1]>0&&h[i][1]>0)r.push(Math.log(h[i][1]/h[i-1][1]));
      if(r.length<20)return;
      const n=a.cls==='crypto'?365:252,m=r.reduce((s,x)=>s+x,0)/r.length,v=r.reduce((s,x)=>s+(x-m)**2,0)/(r.length-1);
      out[a.t]={mu:m*n,sigma:Math.sqrt(v*n),ret1y:h[h.length-1][1]/h[0][1]-1,days:r.length};
    }catch(e){console.warn('stats',a.t,e.message)}
  }));
  return out;
});

const snaps=load('snapshots',[]);
async function collect(){
  try{
    const q=await quotes();
    snaps.push({t:q.t,p:Object.fromEntries(Object.entries(q.quotes).map(([k,v])=>[k,+v.price.toFixed(4)]))});
    while(snaps.length&&snaps[0].t<Date.now()-14*864e5)snaps.shift();
    save('snapshots',snaps);
  }catch(e){console.warn('collect:',e.message)}
}
function priceAt(t,ticker){let best=null;for(const s of snaps){if(s.t<=t)best=s;else break}return best?best.p[ticker]:null}
const snapStart=()=>snaps.length?snaps[0].t:null;
function startCollector(){collect();setInterval(collect,5*60e3).unref()}
module.exports={ASSETS,byT,quotes,history,slice,stats,usd,priceAt,snapStart,startCollector};
