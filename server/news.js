// Новости из RSS: отбираем те, что связаны с активами, и считаем изменение цены после публикации
const crypto=require('crypto');
const {cached,getBuf,decode,load,save}=require('./lib');
const M=require('./market');
const DEF='https://www.interfax.ru/rss.asp,https://rssexport.rbc.ru/rbcnews/news/30/full.rss,https://www.finam.ru/analysis/conews/rsspoint/,https://ru.investing.com/rss/news_25.rss,https://forklog.com/feed';
const FEEDS=(process.env.NEWS_FEEDS||DEF).split(',').map(s=>s.trim()).filter(Boolean);
const EXCLUDE=(process.env.NEWS_EXCLUDE||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
const TAGS={SBER:['сбер','sber'],YDEX:['яндекс','yandex'],GAZP:['газпром'],LKOH:['лукойл'],
  BTC:['биткоин','bitcoin','btc','криптовалют','крипторын'],ETH:['ethereum','эфириум','эфир '],GOLD:['золот','gold'],
  AAPL:['apple','iphone','эппл'],TMOS:['индекс мосбирж','индекс московской бирж','imoex','рынок акций','российских акций'],OFZ:['офз','гособлигац','облигаци']};
const RULES=[
  [/ключев[а-я]* ставк|банк росси|центробанк|цб рф|инфляц/,['OFZ','TMOS','SBER'],'macro'],
  [/нефт|brent|опек/,['LKOH','GAZP','TMOS'],'commodities'],
  [/курс[а-я]* (рубл|доллар|юан)|доллар/,['AAPL','BTC','ETH'],'fx'],
  [/фрс|федрезерв|nasdaq|s&p|уолл-стрит|wall street/,['AAPL','BTC'],'world']];
function classify(text){
  const s=' '+text.toLowerCase()+' ',set=new Set();let cat=null;
  for(const [t,kw] of Object.entries(TAGS))if(kw.some(k=>s.includes(k)))set.add(t);
  for(const [re,ts,c] of RULES)if(re.test(s)){ts.forEach(x=>set.add(x));cat=cat||c}
  const tickers=[...set].slice(0,4);
  if(!cat&&tickers.length)cat=M.byT(tickers[0]).cls;
  return {tickers,cat:cat||'other'};
}
const ENT={quot:'"',apos:"'",laquo:'«',raquo:'»',nbsp:' ',mdash:'—',ndash:'–',hellip:'…',amp:'&',lt:'<',gt:'>'};
function strip(s=''){
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,' ')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n)).replace(/&([a-z]+);/g,(m,n)=>ENT[n]??m)
    .replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}
const tag=(x,n)=>{const m=x.match(new RegExp('<'+n+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+n+'>','i'));return m?strip(m[1]):''};
const store=load('news',[]);
const allNews=()=>cached('news',60e3,async()=>{
  const res=await Promise.allSettled(FEEDS.map(async u=>{
    const xml=decode(await getBuf(u));
    const ch=(xml.match(/<channel>[\s\S]*?<title>([\s\S]*?)<\/title>/)||[])[1];
    return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)].map(m=>({
      title:tag(m[0],'title'),link:tag(m[0],'link'),desc:tag(m[0],'description').slice(0,400),
      t:Date.parse(tag(m[0],'pubDate'))||Date.now(),source:strip(ch||'')||new URL(u).hostname}));
  }));
  res.forEach((r,i)=>{
    if(r.status!=='fulfilled'){console.warn('feed',FEEDS[i],r.reason.message);return}
    for(const it of r.value){
      if(!it.title)continue;
      const id=crypto.createHash('md5').update(it.link||it.title).digest('hex').slice(0,12);
      if(store.some(n=>n.id===id))continue;
      const txt=(it.title+' '+it.desc).toLowerCase();
      if(EXCLUDE.some(w=>txt.includes(w)))continue;
      const c=classify(it.title+' '+it.desc);
      if(!c.tickers.length)continue;
      store.push({id,...it,...c});
    }
  });
  store.sort((a,b)=>b.t-a.t);store.splice(400);save('news',store);
  return store;
});
const byId=id=>store.find(n=>n.id===id);
async function impact(n,holdings){
  const rows=[],q=(await M.quotes()).quotes;let delta=0,base=0,held=false;
  for(const t of n.tickers){
    let p0=null,p1=null,method='1h';const s0=M.snapStart();
    if(s0&&n.t>=s0){p0=M.priceAt(n.t,t);p1=M.priceAt(Math.min(n.t+3600e3,Date.now()),t)}
    if(!(p0>0&&p1>0)){
      method='1d';p0=p1=null;
      const h=await M.history(t).catch(()=>[]);
      const j=h.findIndex(p=>p[0]+864e5>n.t);
      if(j>0){p0=h[j-1][1];p1=h[j][1]}else if(j===-1&&h.length){p0=h[h.length-1][1];p1=q[t]?.price}
    }
    if(!(p0>0&&p1>0))continue;
    const hq=(holdings&&holdings[t]&&holdings[t].qty)||0,d=hq?hq*(p1-p0):null;
    if(hq){held=true;delta+=d;base+=hq*p0}
    rows.push({t,pct:(p1/p0-1)*100,delta:d,method});
  }
  return {rows,held,delta,pct:base?delta/base*100:null};
}
module.exports={FEEDS,allNews,byId,impact};
