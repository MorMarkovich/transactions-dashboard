import {describe,it,expect} from 'vitest'
import {groupMonthCategories} from './monthLegend'
describe('month category grouping',()=>{
 const items=Array.from({length:8},(_,i)=>({name:i===0?'יתר הקטגוריות':`category ${i}`,value:8-i}))
 it('keeps exactly seven real categories',()=>expect(groupMonthCategories(items.slice(0,7))).toEqual(items.slice(0,7)))
 it('groups eight into six plus the exact aggregate',()=>{const grouped=groupMonthCategories(items);expect(grouped).toHaveLength(7);expect(grouped[6]).toEqual({name:'יתר הקטגוריות',value:3,aggregate:true});expect(grouped.reduce((s,i)=>s+i.value,0)).toBe(36)})
 it('does not confuse a custom category with the synthetic group',()=>{const grouped=groupMonthCategories(items);expect(grouped[0].aggregate).toBeUndefined();expect(grouped[6].aggregate).toBe(true);expect(groupMonthCategories(items.slice(0,7)).every(i=>!i.aggregate)).toBe(true)})
})
