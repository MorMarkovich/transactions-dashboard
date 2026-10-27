// Synthetic Messages API contract; never forwards traffic to the Internet.
// https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
const http = require('node:http')
http.createServer((req, res) => {
  const json = (status, data) => {res.writeHead(status, {'content-type':'application/json'}); res.end(JSON.stringify(data))}
  if(req.method !== 'POST' || !req.url.endsWith('/v1/messages')) return json(501,{error:'unmodelled'})
  const body = req.body
  if(!body?.model || !body?.messages?.length || !body?.max_tokens) return json(400,{type:'error',error:{type:'invalid_request_error',message:'invalid contract'}})
  const prompt = body.messages[0].content
  const mode = ['failure','empty','invented','uncertain'].find(x => prompt.includes(`Fixture ${x}`)) || 'ok'
  if(mode === 'failure' && body.tools) return json(200,{id:'msg_fixture',type:'message',role:'assistant',model:body.model,stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1},content:[{type:'web_search_tool_result',tool_use_id:'srvtoolu_fixture',content:{type:'web_search_tool_result_error',error_code:'max_uses_exceeded'}},{type:'text',text:JSON.stringify([{index:0,category:'אוכל',confidence:.99,source_url:'https://merchant.example/about'}])}]})
  const answer = body.tools ? {index:0,category:'אוכל',subcategory:'קניות גדולות',confidence:mode==='uncertain'?.6:.95,source_url:mode==='invented'?'https://invented.example':'https://merchant.example/about'} : {index:0,unknown:true}
  const content = body.tools ? [
   {type:'server_tool_use',id:'srvtoolu_fixture',name:'web_search',input:{query:'Synthetic Merchant'}},
   {type:'web_search_tool_result',tool_use_id:'srvtoolu_fixture',content:mode==='empty'?[]:[{type:'web_search_result',url:'https://merchant.example/about',title:'Synthetic Merchant',encrypted_content:'fixture',page_age:null}]},
  ] : []
  content.push({type:'text',text:JSON.stringify([answer])})
  return json(200,{id:'msg_fixture',type:'message',role:'assistant',model:body.model,content,stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}})
}).listen(process.env.PORT)
