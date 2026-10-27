import test from 'node:test'
import assert from 'node:assert/strict'
import {getCategoryRules} from '../src/supabaseClient.js'
import {buildRuleMap} from '../src/categorize.js'

test('local sync reuses durable identifications while preserving manual choices',async()=>{
 const calls=[]
 const client={from(table){
  const query={select(){return query},eq(key,value){calls.push([table,key,value]);return query},then(resolve){
   resolve({data:table==='user_category_rules'?[
    {merchant:'fixture',category:'קניות',source:'legacy'},
    {merchant:'manual',category:'טיסות ותיירות',source:'manual'},
   ]:[
    {merchant:'fixture',result:{category:'אוכל',confidence:.95}},
    {merchant:'manual',result:{category:'אוכל',confidence:.95}},
   ],error:null})
  }};return query
 }}
 const map=buildRuleMap(await getCategoryRules(client,'owner'))
 assert.equal(map.get('fixture').category,'אוכל')
 assert.equal(map.get('manual').category,'טיסות ותיירות')
 assert(calls.some(c=>c[0]==='merchant_identifications'&&c[1]==='user_id'&&c[2]==='owner'))
 assert(calls.some(c=>c[0]==='merchant_identifications'&&c[1]==='state'&&c[2]==='resolved'))
})
