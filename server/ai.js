// AI-советник: любой OpenAI-совместимый API (OpenAI, DeepSeek, OpenRouter, YandexGPT и др.)
const {cached}=require('./lib');
const KEY=process.env.AI_API_KEY||'',BASE=(process.env.AI_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,''),MODEL=process.env.AI_MODEL||'gpt-4o-mini';
const enabled=()=>!!KEY;
const RULES='Ты AI-помощник учебного симулятора InvestStart для начинающих инвесторов. Портфель пользователя виртуальный. '+
 'Отвечай по-русски, коротко (до 120 слов), простым языком. Опирайся только на данные из контекста, не выдумывай цифры. '+
 'Не давай индивидуальных инвестиционных рекомендаций: не говори «купите/продайте X», объясняй принципы (диверсификация, риск, ребалансировка, горизонт). '+
 'Не обсуждай политику, войны и религию. Если вопрос не про инвестиции и финансовую грамотность, вежливо верни разговор к портфелю.';
async function chat(messages,{json=false,max=400}={}){
  if(!KEY)throw new Error('AI_API_KEY не задан');
  const body={model:MODEL,messages,temperature:.4,max_tokens:max};
  if(json)body.response_format={type:'json_object'};
  const r=await fetch(BASE+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+KEY},body:JSON.stringify(body),signal:AbortSignal.timeout(35000)});
  if(!r.ok)throw new Error('AI HTTP '+r.status+' '+(await r.text()).slice(0,200));
  const j=await r.json();return (j.choices?.[0]?.message?.content||'').trim();
}
const parse=s=>{try{return JSON.parse(s.replace(/^```(json)?|```$/g,''))}catch{return null}};
function context(ctx){
  return 'Контекст на '+new Date().toISOString().slice(0,10)+':\n'+JSON.stringify(ctx);
}
const tips=ctx=>cached('ai:tips:'+require('crypto').createHash('md5').update(JSON.stringify(ctx.assets||[])).digest('hex'),30*60e3,async()=>{
  const out=parse(await chat([{role:'system',content:RULES},{role:'user',content:context(ctx)+
    '\nДай 4 совета по портфелю на основе контекста. Ответ строго JSON: {"tips":[{"level":"good|warn|bad|info","title":"до 70 символов","text":"до 220 символов"}]}'}],{json:true,max:700}));
  const I={good:['good','↑'],warn:['warn','!'],bad:['bad','↓'],info:['','i']};
  return (out?.tips||[]).slice(0,5).map(t=>[...(I[t.level]||I.info),String(t.title||''),String(t.text||'')]).filter(t=>t[2]);
});
const notes=list=>cached('ai:notes:'+list.map(n=>n.id).join(''),6*3600e3,async()=>{
  const out=parse(await chat([{role:'system',content:RULES},{role:'user',content:'Для каждой новости одним-двумя предложениями объясни новичку, как такое событие обычно влияет на указанные активы. JSON: {"notes":{"<id>":"текст"}}\n'+
    JSON.stringify(list.map(n=>({id:n.id,title:n.title,assets:n.tickers})))}],{json:true,max:1500}));
  return out?.notes||{};
});
async function answer(q,history,ctx){
  const h=(Array.isArray(history)?history:[]).slice(-6).filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').map(m=>({role:m.role,content:m.content.slice(0,1500)}));
  return chat([{role:'system',content:RULES+'\n'+context(ctx)},...h,{role:'user',content:q}]);
}
module.exports={enabled,tips,notes,answer,MODEL};
