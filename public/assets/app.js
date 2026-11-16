// InvestStart: данные, утилиты, графики, поток реального времени и демо-сделки
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const R=(s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296})(11);
const gauss=(r=R)=>{let u=0;while(!u)u=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*r())};
const fm=(n,d=0)=>(+n).toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d});
const rub=(n,d=0)=>fm(n,d)+'\u00a0₽';
const pc=(x,d=2)=>(x>=0?'+':'−')+fm(Math.abs(x*100),d)+'%';
const cls=x=>x>=0?'up':'dn';
const short=v=>Math.abs(v)>=1e6?fm(v/1e6,2)+' млн':Math.abs(v)>=1e3?fm(v/1e3,0)+' тыс':fm(v,v<10?2:0);
const price=p=>p>=1000?rub(p):p>=10?rub(p,2):rub(p,3);
const KN={crypto:'Криптовалюта',stock:'Акции',bond:'Облигации',etf:'Фонды',gold:'Золото',cash:'Кэш'};
const KC={crypto:'#F7931A',stock:'#15803d',bond:'#0071e3',etf:'#6366f1',gold:'#b45309',cash:'#6e6e73'};
const A=[
{t:'BTC',n:'Bitcoin',k:'crypto',c:'#F7931A',s:'₿',p:8450000,q:.035,avg:6900000,mu:.45,v:.55,r:5},
{t:'ETH',n:'Ethereum',k:'crypto',c:'#627EEA',s:'Ξ',p:285000,q:.6,avg:300000,mu:.25,v:.7,r:5},
{t:'SBER',n:'Сбербанк',k:'stock',c:'#21A038',s:'С',p:312,q:600,avg:268,mu:.2,v:.28,r:3},
{t:'YDEX',n:'Яндекс',k:'stock',c:'#FC3F1D',s:'Я',p:4180,q:30,avg:3900,mu:.15,v:.35,r:4},
{t:'GAZP',n:'Газпром',k:'stock',c:'#0079C2',s:'Г',p:125,q:0,avg:125,mu:.14,v:.32,r:3},
{t:'LKOH',n:'Лукойл',k:'stock',c:'#E30613',s:'Л',p:6400,q:0,avg:6400,mu:.16,v:.26,r:3},
{t:'AAPL',n:'Apple',k:'stock',c:'#1d1d1f',s:'A',p:21400,q:8,avg:19800,mu:.12,v:.3,r:3},
{t:'GOLD',n:'Золото (БПИФ)',k:'gold',c:'#b45309',s:'Au',p:8950,q:20,avg:7600,mu:.22,v:.15,r:2},
{t:'OFZ',n:'ОФЗ 26238',k:'bond',c:'#0071e3',s:'₽',p:985,q:150,avg:960,mu:.09,v:.06,r:1},
{t:'TMOS',n:'Индекс МосБиржи',k:'etf',c:'#6366f1',s:'M',p:7.1,q:15000,avg:6.6,mu:.14,v:.22,r:3},
{t:'RUB',n:'Рубли (свободные)',k:'cash',c:'#6e6e73',s:'₽',p:1,q:60000,avg:1,mu:0,v:0,r:1}];
const AT=Object.fromEntries(A.map(a=>[a.t,a]));
const ALL=[...A];

let USERPF=null;try{const x=JSON.parse(localStorage.getItem('is_pf')||'null');if(x&&x.h&&typeof x.h=='object')USERPF=x}catch(e){}
let TRADES=[];try{const x=JSON.parse(localStorage.getItem('is_tr')||'[]');if(Array.isArray(x))TRADES=x}catch(e){}

const KD={crypto:[.3,.6,5],stock:[.15,.3,3],bond:[.09,.06,1],etf:[.14,.22,3],gold:[.2,.15,2],cash:[0,0,1]};
const clean=s=>String(s||'').replace(/[<>&"'`]/g,'').trim().slice(0,40);

function syncHoldings(){
  if(USERPF){
    const H={};
    Object.entries(USERPF.h).forEach(([t,x])=>{if(/^[A-Z0-9]{1,10}$/.test(t)&&x&&+x.q>0)H[t]=x});
    Object.entries(H).forEach(([t,x])=>{
      if(AT[t]||!x.c||!(+x.c.p>0)){if(!AT[t])delete H[t];return}
      const k=KD[x.c.k]?x.c.k:'stock',d=KD[k],hu=t.split('').reduce((s,c)=>s*31+c.charCodeAt(0),7)%360;
      const a={t,n:clean(x.c.n)||t,k,c:`hsl(${hu} 60% 42%)`,s:t[0],p:+x.c.p,mu:d[0],v:d[1],r:d[2],cu:1};
      ALL.push(a);AT[t]=a;
    });
    if(Object.keys(H).length){
      ALL.forEach(a=>{const x=H[a.t];a.q=x?+x.q:0;a.avg=x&&+x.avg>0?+x.avg:a.p});
    }else USERPF=null;
  }
  A.length=0;
  ALL.filter(a=>a.q>0).forEach(a=>A.push(a));
}
function applyPF(){syncHoldings()}

function saveUserPF(){
  const H={};
  ALL.forEach(a=>{
    if(a.q>0){
      H[a.t]={q:+a.q.toFixed(8),avg:+a.avg.toFixed(4),...(a.cu?{c:{n:a.n,k:a.k,p:a.p}}:{})};
    }
  });
  if(!H.RUB)H.RUB={q:0,avg:1};
  USERPF={v:1,h:H};
  try{localStorage.setItem('is_pf',JSON.stringify(USERPF))}catch(e){}
}

function tradeDemo(side,t,qty){
  const a=AT[t];
  if(!a||a.k==='cash')return{ok:false,err:'Выберите рыночный инструмент'};
  const q=+qty;
  if(!(q>0))return{ok:false,err:'Укажите корректное количество'};
  const rubAsset=AT.RUB;
  const px=a.p;
  const sum=q*px;
  if(side==='buy'){
    if((rubAsset.q||0)+1e-6<sum)return{ok:false,err:'Недостаточно свободных рублей на счёте'};
    const prevQ=a.q||0;
    const prevCost=prevQ*(a.avg||px);
    a.q=+(prevQ+q).toFixed(8);
    a.avg=+((prevCost+sum)/a.q).toFixed(4);
    rubAsset.q=Math.max(0,+(rubAsset.q-sum).toFixed(2));
  }else{
    if((a.q||0)+1e-8<q)return{ok:false,err:'Недостаточно бумаг для продажи'};
    a.q=Math.max(0,+(a.q-q).toFixed(8));
    if(a.q===0)a.avg=px;
    rubAsset.q=+((rubAsset.q||0)+sum).toFixed(2);
  }
  saveUserPF();
  syncHoldings();
  recalcMetrics();
  TRADES.unshift({id:Date.now(),ts:new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),side,t,n:a.n,q,px,sum});
  TRADES.splice(50);
  try{localStorage.setItem('is_tr',JSON.stringify(TRADES))}catch(e){}
  emitLive('trade');
  return{ok:true,sum,px};
}

function ctxC(){return{portfolio_rub:Math.round(TOT),assets:A.map(a=>({t:a.t,name:a.n,share:+(a.val/TOT*100).toFixed(1),ch30d:+(a.c30*100).toFixed(1),pnl:+((a.p/a.avg-1)*100).toFixed(1)})),news:NEWS.slice(0,8).map(n=>n.t)}}
let NEWS=[
{d:2,cat:'Ставки',t:'ЦБ сохранил ключевую ставку и смягчил прогноз',x:'Регулятор оставил ставку без изменений, но дал понять, что снижение возможно уже в начале следующего года. Рынок воспринял сигнал позитивно.',im:{OFZ:.7,SBER:2.1,TMOS:1.4,YDEX:1.1},ai:'Мягкий сигнал ЦБ обычно поддерживает облигации и банки. Хороший момент проверить, не слишком ли мала доля облигаций в портфеле.'},
{d:6,cat:'Отчёты',t:'Сбербанк отчитался о рекордной квартальной прибыли',x:'Чистая прибыль банка выросла на 14% год к году, менеджмент подтвердил план по дивидендам.',im:{SBER:4.6,TMOS:1.2},ai:'Сильный отчёт уже в цене. Не докупайте на эмоциях после роста, лучше распределять покупки во времени.'},
{d:11,cat:'Крипто',t:'Крупный пенсионный фонд вложился в биткоин-ETF',x:'Институциональный спрос на криптовалюту продолжает расти: фонд разместил часть резервов в биржевом фонде на биткоин.',im:{BTC:7.8,ETH:5.2},ai:'Резкий рост крипты увеличил её долю в портфеле. Проверьте, не вышла ли она за ваш лимит риска.'},
{d:18,cat:'Акции',t:'Apple снизила прогноз продаж на следующий квартал',x:'Компания представила новые устройства, но предупредила о слабом спросе в ряде регионов.',im:{AAPL:-5.1,TMOS:-.3},ai:'Падение одной компании после отчёта не повод продавать всё. Диверсификация как раз смягчает такие удары.'},
{d:25,cat:'Макро',t:'Инфляция в США оказалась выше ожиданий',x:'Рынки начали закладывать более долгий период высоких ставок. Рисковые активы подешевели, золото выросло.',im:{AAPL:-2.3,BTC:-4.6,ETH:-6.1,GOLD:2.2,YDEX:-1.2},ai:'Классическая реакция: риск дешевеет, защитные активы дорожают. Золото в портфеле частично компенсировало просадку.'},
{d:33,cat:'Отчёты',t:'Яндекс увеличил выручку сервисов на 35%',x:'Рост показали все ключевые направления, компания повысила прогноз на год.',im:{YDEX:6.4,TMOS:.9},ai:'Хороший пример, почему держать качественные компании на горизонте лет выгоднее, чем угадывать дни.'},
{d:41,cat:'Сырьё',t:'Золото обновило исторический максимум',x:'Спрос центральных банков и инвесторов на защитные активы остаётся высоким.',im:{GOLD:3.6},ai:'Золото выполняет роль страховки. Доля 5–15% считается разумной для умеренного профиля.'},
{d:52,cat:'Крипто',t:'Взлом крупной криптобиржи: похищено $400 млн',x:'Биржа приостановила вывод средств. Инвесторы начали массово выводить активы с централизованных площадок.',im:{BTC:-8.4,ETH:-10.6},ai:'Криптовалюта может падать на 10% за день. Вкладывайте в неё только ту сумму, потерю которой готовы пережить.'},
{d:64,cat:'Ставки',t:'ЦБ снизил ключевую ставку на 1 п.п.',x:'Снижение оказалось больше ожиданий аналитиков. Облигации и акции выросли.',im:{OFZ:1.6,SBER:3.2,YDEX:2.5,TMOS:2.7},ai:'При снижении ставок длинные облигации растут в цене. Это причина держать их в портфеле не только ради купонов.'},
{d:80,cat:'Крипто',t:'Обновление сети Ethereum прошло без сбоев',x:'Комиссии в сети снизились, разработчики анонсировали следующий этап.',im:{ETH:9.3,BTC:1.1},ai:'Технологические новости дают сильные, но короткие движения. Не стоит строить на них долгосрочную стратегию.'},
{d:97,cat:'Макро',t:'ФРС сохранила ставку, рынки облегчённо выдохнули',x:'Регулятор не стал ужесточать политику, индексы акций выросли.',im:{AAPL:2.7,BTC:2.4,ETH:2.1},ai:'Решения ФРС влияют на все мировые рынки. Полезно знать даты заседаний заранее.'},
{d:120,cat:'Акции',t:'Распродажа в технологическом секторе',x:'Инвесторы фиксировали прибыль после долгого роста, технологические бумаги упали сильнее рынка.',im:{AAPL:-5.6,YDEX:-4.1,TMOS:-2.3,BTC:-3.2},ai:'Коррекции случаются регулярно. Портфель, где есть облигации и золото, падает заметно меньше.'}];
let N=365,DAY=864e5,T0=new Date(2026,10,16),D,L,PV,TOT,INV;

const fd=(d,y)=>d.toLocaleDateString('ru-RU',y?{day:'numeric',month:'long',year:'numeric'}:{day:'numeric',month:'short'}).replace('.','');

function recalcMetrics(){
  ALL.forEach(a=>{
    if(a.h&&a.h.length===N)a.h[N-1]=a.p;
    a.val=(a.q||0)*a.p;
    if(a.h&&a.h.length>=2&&a.h[N-2]>0&&a.ch==null)a.ch=a.h[N-1]/a.h[N-2]-1;
    if(a.ch==null)a.ch=0;
    a.c30=(a.h&&a.h.length>=31&&a.h[N-31]>0)?a.h[N-1]/a.h[N-31]-1:0;
    a.pnl=(a.q||0)*(a.p-(a.avg||a.p));
  });
  PV=D.map((_,i)=>A.reduce((s,a)=>s+(a.q||0)*(a.h?a.h[i]:a.p),0));
  TOT=PV[N-1]||0;
  INV=A.reduce((s,a)=>s+(a.q||0)*(a.avg||a.p),0);
  NEWS.forEach(n=>{
    const i=Math.max(1,Math.min(N-1,N-1-n.d));
    n.i=i;n.date=D[i];
    n.per=Object.keys(n.im).filter(t=>AT[t]&&AT[t].q>0).map(t=>{const a=AT[t];return{a,r:a.h[i]/a.h[i-1]-1,v:a.q*(a.h[i]-a.h[i-1])}});
    n.v=n.per.reduce((s,p)=>s+p.v,0);
    n.r=PV[i-1]?n.v/PV[i-1]:0;
  });
}

function build(){
  D=[...Array(N)].map((_,i)=>new Date(+T0-(N-1-i)*DAY));L=D.map(d=>fd(d));
  ALL.forEach(a=>{
    if(a.live&&a.h&&a.h.length===N){
      a.val=a.q*a.p;
      if(a.ch==null)a.ch=a.h[N-1]/a.h[N-2]-1;
      a.c30=a.h[N-1]/a.h[N-31]-1;
      a.pnl=a.q*(a.p-a.avg);
      return;
    }
    const x=[1];
    for(let i=1;i<N;i++){
      let sh=0,ev=0;
      NEWS.forEach(n=>{if(N-1-n.d===i&&n.im[a.t]!=null){sh+=n.im[a.t]/100;ev=1}});
      const r=a.v?a.mu/365+a.v/Math.sqrt(365)*gauss()*(ev?.25:.75)+sh:0;
      x.push(x[i-1]*(1+r));
    }
    const k=a.p/x[N-1];a.h=x.map(v=>v*k);
  });
  recalcMetrics();
}

function share(){const o={};A.forEach(a=>o[a.k]=(o[a.k]||0)+a.val);const t=TOT||1;return Object.entries(o).map(([k,v])=>({k,n:KN[k],c:KC[k],v,w:v/t})).sort((a,b)=>b.v-a.v)}
function risk(){const t=TOT||1;const w=A.reduce((s,a)=>s+a.r*a.val,0)/t;return Math.min(10,Math.max(1,Math.round((w-1)/4*9+1)))}
function vol(arr){const r=arr.slice(1).map((v,i)=>arr[i]>0?v/arr[i]-1:0),m=r.reduce((s,x)=>s+x,0)/(r.length||1);return Math.sqrt(r.reduce((s,x)=>s+(x-m)**2,0)/(r.length||1)*365)}
function mdd(arr){let pk=arr[0]||1,m=0;arr.forEach(v=>{pk=Math.max(pk,v);if(pk>0)m=Math.min(m,v/pk-1)});return m}
const ic=(a,z=32)=>`<span class="ic" style="width:${z}px;height:${z}px;background:${a.c};font-size:${Math.round(z*(a.s.length>1?.38:.5))}px">${a.s}</span>`;
const SV={
  home:'<path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  trade:'<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
  pie:'<path d="M21 12A9 9 0 1112 3v9z"/><path d="M15 3.5A9 9 0 0120.5 9H15z"/>',
  news:'<path d="M4 5h13v14H6a2 2 0 01-2-2zM17 9h3v8a2 2 0 01-2 2M8 9h5M8 13h5"/>',
  ai:'<path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 15l1 2.5 2.5 1-2.5 1L19 22l-1-2.5-2.5-1 2.5-1z"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  bell:'<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  sim:'<path d="M3 3v18h18"/><path d="M7 14l4-4 4 3 5-6"/>',
  book:'<path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5zM4 19.5A2.5 2.5 0 006.5 22H20v-5"/>',
  out:'<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
  eye:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>'
};
const svg=(k,z=20)=>`<svg width="${z}" height="${z}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${SV[k]}</svg>`;
const PG=[['index','Главная'],['simulator','Симулятор риска'],['news','Новости'],['dashboard','Личный кабинет']];

function renderTicker(){
  const el=$('#tk-bar');if(!el)return;
  const it=ALL.filter(a=>a.k!='cash').map(a=>`<span>${ic(a,18)}<b>${a.t}</b> ${price(a.p)} <em class="${cls(a.ch)}" style="font-style:normal">${pc(a.ch)}</em></span>`).join('');
  el.innerHTML=`<div class="tk">${it+it+it+it}</div>`;
}

function shell(){const p=document.body.dataset.p;
 const h=document.createElement('header');h.className='hdr';
 h.innerHTML=`<div class="wrap"><a href="index.html" class="logo"><i>IS</i>InvestStart</a><nav class="nav" id="nav">${PG.map(([u,t])=>`<a href="${u}.html" class="${u==p?'on':''}">${t}</a>`).join('')}</nav><span class="live-pill" id="live-st"><span class="pulse"></span><b>Live</b> <span id="live-tm">сейчас</span></span><a class="btn sm cta" href="dashboard.html">Мой портфель</a><button class="burger" style="margin-left:auto" aria-label="Меню" onclick="document.getElementById('nav').classList.toggle('open')">☰</button></div>`;
 document.body.prepend(h);
 if(p!='dashboard'){const t=document.createElement('div');t.className='ticker';t.id='tk-bar';h.after(t);renderTicker();
 const f=document.createElement('footer');f.className='ftr';f.innerHTML=`<div class="wrap"><div><b style="color:var(--txt)">InvestStart</b> · учебный симулятор для начинающих инвесторов<br>${LIVE?'Котировки: MOEX, Binance, Yahoo Finance, ЦБ РФ в реальном времени. Новости: RSS-ленты. Портфель виртуальный.':'Демо-режим: данные и новости демонстрационные.'} Не является инвестиционной рекомендацией.</div><div class="row">${PG.map(([u,t])=>`<a href="${u}.html">${t}</a>`).join('')}</div></div>`;document.body.append(f)}
 const ts=document.createElement('div');ts.className='toast';ts.id='toast';document.body.append(ts)}
function toast(m){const t=$('#toast');if(!t)return;t.textContent=m;t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),2600)}

function line(el,o){const draw=()=>{const W=el.clientWidth,H=el.clientHeight;if(!W)return;const ax=!o.noAx,pl=6,pr=ax?74:6,pt=14,pb=ax?28:6;
 let all=o.s.flatMap(s=>s.d);(o.b||[]).forEach(b=>all=all.concat(b.lo,b.hi));let mn=Math.min(...all),mx=Math.max(...all),pd=(mx-mn)*.08||1;mn-=pd;mx+=pd;
 const n=o.s[0].d.length,X=i=>pl+(W-pl-pr)*i/(n-1),Y=v=>pt+(H-pt-pb)*(1-(v-mn)/(mx-mn));let g='';
 if(ax){for(let k=0;k<=4;k++){const v=mn+(mx-mn)*k/4,y=Y(v);g+=`<line x1="${pl}" x2="${W-pr}" y1="${y}" y2="${y}" stroke="#e6e5e1" stroke-dasharray="2 4"/><text x="${W-pr+10}" y="${y+4}" fill="#6e6e73" font-size="11">${(o.yf||short)(v)}</text>`}
  if(o.l){const c=W<520?3:6,st=Math.max(1,Math.floor((n-1)/c));for(let i=0;i<n;i+=st)g+=`<text x="${X(i)}" y="${H-8}" fill="#6e6e73" font-size="11" text-anchor="${i==0?'start':'middle'}">${o.l[i]}</text>`}}
 (o.b||[]).forEach(b=>{g+=`<path d="M${b.hi.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' L')} L${b.lo.map((v,i)=>i).reverse().map(i=>X(i).toFixed(1)+','+Y(b.lo[i]).toFixed(1)).join(' L')}Z" fill="${b.c}" opacity="${b.o||.12}"/>`});
 o.s.forEach(s=>{const p=s.d.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' L');
  if(s.a){const id='g'+Math.random().toString(36).slice(2,8);g+=`<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.c}" stop-opacity=".18"/><stop offset="1" stop-color="${s.c}" stop-opacity="0"/></linearGradient></defs><path d="M${p} L${X(n-1)},${H-pb} L${X(0)},${H-pb}Z" fill="url(#${id})"/>`}
  g+=`<path d="M${p}" fill="none" stroke="${s.c}" stroke-width="${s.w||2}" ${s.dash?'stroke-dasharray="5 5"':''} stroke-linejoin="round" stroke-linecap="round"/>`});
 const mk=(o.m||[]).map(m=>`<g data-m="${m.id}" style="cursor:pointer"><circle cx="${X(m.i)}" cy="${Y(o.s[0].d[m.i])}" r="11" fill="${m.c}" opacity=".18"/><circle cx="${X(m.i)}" cy="${Y(o.s[0].d[m.i])}" r="5" fill="${m.c}" stroke="#ffffff" stroke-width="2"/></g>`).join('');
 el.innerHTML=`<svg viewBox="0 0 ${W} ${H}">${g}<line class="hx" y1="${pt}" y2="${H-pb}" stroke="#9ca3af" stroke-dasharray="3 3" style="display:none"/><circle class="hd0" r="4.5" fill="${o.s[0].c}" stroke="#fff" stroke-width="2" style="display:none"/>${mk}</svg><div class="tip"></div>`;
 const sv=el.querySelector('svg'),tip=el.querySelector('.tip'),hx=sv.querySelector('.hx'),hd=sv.querySelector('.hd0');
 const mv=e=>{const r=sv.getBoundingClientRect(),cx=(e.touches?e.touches[0].clientX:e.clientX)-r.left;let i=Math.round((cx-pl)/(W-pl-pr)*(n-1));i=Math.max(0,Math.min(n-1,i));const x=X(i),y=Y(o.s[0].d[i]);
  hx.setAttribute('x1',x);hx.setAttribute('x2',x);hx.style.display=hd.style.display='';hd.setAttribute('cx',x);hd.setAttribute('cy',y);
  tip.innerHTML=o.tf?o.tf(i):`<span class="mut">${o.l?o.l[i]:''}</span> <b>${(o.vf||rub)(o.s[0].d[i])}</b>`;tip.style.left=Math.min(Math.max(x,80),W-80)+'px';tip.style.top=Math.max(y,46)+'px';tip.style.opacity=1};
 sv.addEventListener('mousemove',mv);sv.addEventListener('touchstart',mv,{passive:true});sv.addEventListener('touchmove',mv,{passive:true});
 sv.addEventListener('mouseleave',()=>{tip.style.opacity=0;hx.style.display=hd.style.display='none'});
 sv.querySelectorAll('[data-m]').forEach(c=>c.addEventListener('click',()=>o.onM&&o.onM(c.dataset.m)))};
 el._d=draw;draw();if(!el._ro&&window.ResizeObserver){let w=el.clientWidth;el._ro=new ResizeObserver(()=>{if(el.clientWidth!=w){w=el.clientWidth;el._d()}});el._ro.observe(el)}}

function donut(el,it,lbl){const T=it.reduce((s,x)=>s+x.v,0)||1,C=2*Math.PI*70;let off=0;
 el.innerHTML=`<svg viewBox="0 0 180 180" style="width:100%;display:block"><circle r="70" cx="90" cy="90" fill="none" stroke="#f0efeb" stroke-width="18"/>${it.map((x,i)=>{const l=x.v/T*C,s=`<circle data-i="${i}" r="70" cx="90" cy="90" fill="none" stroke="${x.c}" stroke-width="18" stroke-dasharray="${Math.max(l-2,0)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 90 90)" style="cursor:pointer;transition:stroke-width .2s"/>`;off+=l;return s}).join('')}<text x="90" y="84" text-anchor="middle" fill="#6e6e73" font-size="11" class="d1">${lbl[0]}</text><text x="90" y="104" text-anchor="middle" fill="#1d1d1f" font-size="16" font-weight="700" class="d2">${lbl[1]}</text></svg>`;
 const d1=el.querySelector('.d1'),d2=el.querySelector('.d2');
 el.querySelectorAll('[data-i]').forEach(c=>{c.onmouseenter=()=>{const x=it[c.dataset.i];c.setAttribute('stroke-width',24);d1.textContent=x.n;d2.textContent=fm(x.v/T*100,1)+'%'};c.onmouseleave=()=>{c.setAttribute('stroke-width',18);d1.textContent=lbl[0];d2.textContent=lbl[1]}})}

function spark(d,c,w=96,h=32){const mn=Math.min(...d),mx=Math.max(...d);return`<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="M${d.map((v,i)=>(i*w/(d.length-1)).toFixed(1)+','+(h-2-(v-mn)/(mx-mn||1)*(h-4)).toFixed(1)).join(' L')}" fill="none" stroke="${c}" stroke-width="1.7"/></svg>`}

let LIVE=null;const CH=[];
const LISTENERS=new Set();
function onLiveUpdate(fn){LISTENERS.add(fn)}
function emitLive(kind,payload){
  const tm=$('#live-tm');
  if(tm)tm.textContent=new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  LISTENERS.forEach(fn=>{try{fn(kind,payload)}catch(e){console.warn(e)}});
}

function applyIncomingQuotes(qmap){
  if(!qmap)return false;
  let changed=false;
  Object.entries(qmap).forEach(([t,q])=>{
    const a=AT[t];
    if(!a||!(q.price>0))return;
    if(a.p!==q.price)changed=true;
    a.p=q.price;
    if(q.change!=null)a.ch=q.change/100;
  });
  if(changed){
    recalcMetrics();
    renderTicker();
  }
  return changed;
}

function applyIncomingNews(list){
  if(!Array.isArray(list)||!list.length)return false;
  const fresh=list.filter(n=>n.d>=0&&n.d<N-1);
  if(!fresh.length)return false;
  const prevTop=NEWS[0]?.id||NEWS[0]?.t;
  const nextTop=fresh[0]?.id||fresh[0]?.t;
  const isNew=prevTop&&nextTop&&prevTop!==nextTop;
  NEWS=fresh;
  recalcMetrics();
  if(isNew)toast('Новая новость: '+NEWS[0].t);
  return isNew;
}

function startRealtime(){
  if(!location.protocol.startsWith('http'))return;
  let sseOk=false;
  if(window.EventSource){
    try{
      const es=new EventSource((window.IS_API||'')+'/api/stream');
      es.onopen=()=>{sseOk=true};
      es.onmessage=e=>{
        try{
          const d=JSON.parse(e.data);
          const qCh=applyIncomingQuotes(d.quotes);
          const nCh=applyIncomingNews(d.news);
          emitLive(nCh?'news':qCh?'quotes':'tick',d);
        }catch{}
      };
      es.onerror=()=>{sseOk=false};
    }catch{}
  }
  setInterval(async()=>{
    if(sseOk)return;
    try{
      const q=await api('/quotes',{t:5000});
      if(applyIncomingQuotes(q.quotes))emitLive('quotes',q);
    }catch{}
  },5000);
  setInterval(async()=>{
    if(sseOk)return;
    try{
      const nl=await api('/news',{t:8000});
      if(applyIncomingNews(nl))emitLive('news',nl);
    }catch{}
  },30000);
}

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(u,o={}){const c=new AbortController(),tm=setTimeout(()=>c.abort(),o.t||8000);try{const r=await fetch((window.IS_API||'')+'/api'+u,{...o,signal:c.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(tm)}}
async function aiAsk(q){if(!LIVE||!LIVE.ai)return null;try{const r=await api('/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q,history:CH.slice(-6),ctx:USERPF?ctxC():undefined}),t:40000});if(!r.answer)return null;CH.push({role:'user',content:q},{role:'assistant',content:r.answer});return esc(r.answer).replace(/\n/g,'<br>')}catch(e){return null}}
const READY=(location.protocol.startsWith('http')?api('/bundle',{t:20000}).then(b=>{
 N=b.days.length;T0=new Date(b.days[N-1]);
 ALL.forEach(a=>{const x=b.assets[a.t];if(x)Object.assign(a,{p:x.p,q:x.q,avg:x.avg,ch:x.ch!=null?x.ch:a.ch,h:x.h,n:x.n||a.n,live:1})});
 NEWS=b.news.filter(n=>n.d>=0&&n.d<N-1);LIVE=b;
}).catch(e=>console.warn('Демо-режим:',e.message)):Promise.resolve()).then(()=>{applyPF();build();startRealtime()});
