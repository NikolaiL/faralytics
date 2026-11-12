import assert from "node:assert/strict";
import { test } from "node:test";
import { casterPath, casterRange, casterSelection } from "../packages/nextjs/lib/top-casters.ts";

test("caster timeframes use inclusive UTC days and anchor yesterday separately", () => {
  const end="2026-11-12";
  for(const [period,start,through] of [
    ['today',end,end],['yesterday','2026-11-11','2026-11-11'],['days7','2026-11-06',end],
    ['days30','2026-10-14',end],['days365','2025-11-13',end],['all','2021-01-01',end],
  ]) assert.deepEqual(casterRange(casterSelection(new URLSearchParams({period,end}))),{start,through});
  assert.equal(casterRange(casterSelection(new URLSearchParams('period=days365&end=2024-03-01'))).start,'2023-03-03');
});
test("caster filters reject invalid input and preserve UInt64 identity in list shares",()=>{
  const selection=casterSelection(new URLSearchParams('user=18446744073709551615&period=yesterday&end=2026-11-12&metric=mentions_received'));
  const path=casterPath(selection,'1794450000000');
  assert.equal(path,'/top-casters?period=yesterday&end=2026-11-12&user=18446744073709551615&metric=mentions_received&ts=1794450000000');
  assert.deepEqual(casterSelection(new URLSearchParams(path.split('?')[1])),selection);
  for(const query of ['user=0','user=18446744073709551616','user=1 OR 1','period=week','metric=constructor','period=toString','end=2099-01-01','end=2026-02-30','user=1&user=2','ts=abc'])assert.throws(()=>casterSelection(new URLSearchParams(query)));
});
