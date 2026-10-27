// Synthetic Tavily/Gemini contracts. No request is forwarded to the internet.
const http=require('node:http')
let mode='ok',calls={usage:0,search:0,gemini:0}
http.createServer((req,res)=>{
 const json=(s,b)=>{res.writeHead(s,{'content-type':'application/json'});res.end(JSON.stringify(b))}
 if(req.url.endsWith('/scenario')&&req.method==='POST'){mode=req.body.mode;calls={usage:0,search:0,gemini:0};return json(200,{ok:true})}
 if(req.url.endsWith('/calls'))return json(200,calls)
 if(req.url.endsWith('/usage')){calls.usage++;return json(200,{account:{current_plan:mode==='paid'?'Bootstrap':'Researcher',plan_usage:0,plan_limit:1000,paygo_usage:0,paygo_limit:mode==='paygo'?100:null}})}
 if(req.url.endsWith('/search')){
  calls.search++
  const b=req.body
  if(b.search_depth!=='basic'||b.auto_parameters!==false||Object.keys(b).some(k=>!['query','search_depth','auto_parameters','max_results','include_answer','include_raw_content'].includes(k)))return json(400,{error:'Unexpected search data'})
  if(mode==='quota')return json(429,{detail:'Quota'})
  return json(200,{results:mode==='empty'?[]:[{url:'https://merchant.example/about',title:'Synthetic grocery',content:'Synthetic grocery is a supermarket.'}]})
 }
 if(req.url.endsWith('/v1beta/models/gemini-2.5-flash:generateContent')){
  calls.gemini++
  const b=req.body
  if(b.tools||!b.contents?.[0]?.parts?.[0]?.text||b.generationConfig?.thinkingConfig?.thinkingBudget!==0)return json(400,{error:'Unexpected Gemini contract'})
  if(mode==='malformed')return json(200,{candidates:[{finishReason:'STOP',content:{parts:[{text:'not json'}]}}]})
  const answer={category:'אוכל',subcategory:'קניות גדולות',confidence:mode==='uncertain'?.4:.95,source_url:mode==='invented'?'https://invented.example':'https://merchant.example/about'}
  return json(200,{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(answer)}]}}]})
 }
 json(501,{error:'Unmodelled'})
}).listen(process.env.PORT)
