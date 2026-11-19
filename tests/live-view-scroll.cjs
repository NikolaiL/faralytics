const assert=require('node:assert/strict');
const{chromium,expect}=require('@playwright/test');
const origin=process.env.TEST_ORIGIN||'http://localhost:3100',start=Date.parse('2026-11-19T12:00:00Z');
const profile={fid:'3',username:'caster',display_name:null};
const event=(id,action)=>({id:String(id),cursor:`${start/1000}:0x${id.toString(16).padStart(40,'0')}`,timestamp:new Date(start-(200-id)*1000).toISOString(),action,actor:profile,target:profile,text:'Captured activity for scrolling',castHash:'0x'+'a'.repeat(40),mentions:[],mentionCount:0});
const counts={casts:1,replies:2,recasts:3,likes:4,mentions:5,dau:1};
(async()=>{const browser=await chromium.launch();try{
 const page=await browser.newPage({viewport:{width:390,height:700}}),requests=[],errors=[];let next=21;
 page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:start});await page.clock.pauseAt(start);
 await page.route('**/api/live-view?*',route=>{const params=new URL(route.request().url()).searchParams;requests.push(params);const offset=params.get('type')==='like'?100:0,action=offset?'like':'cast';return route.fulfill({json:{events:params.has('after')?[event(offset+next,action)]:Array.from({length:20},(_,i)=>event(offset+20-i,action)),headCursor:`${start/1000}:0x${'a'.repeat(40)}`,hasMore:false,profile:null,date:'2026-11-19',now:new Date(start).toISOString(),totals:{today:counts,yesterday:counts,asOf:new Date(start).toISOString()},source:{checkedAt:null,catchingUp:false,coverage:'Captured history is incomplete.'}}});});
 await page.goto(origin+'/live-view');await expect(page.locator('.live-events li')).toHaveCount(20);
 const first=()=>page.locator('.live-events li').first(),button=page.getByRole('button',{name:'Show new events ↑'});
 const scroll=async top=>{await page.evaluate(top=>scrollTo(0,top),top);await page.clock.runFor(20);};
 const poll=async id=>{await page.waitForLoadState('networkidle');next=id;await page.clock.runFor(5000);await expect(button).toBeVisible();};
 await scroll(1000);const oldScroll=await page.evaluate(()=>scrollY);await poll(21);await expect(first()).toHaveAttribute('data-event-id','20');assert.equal(await page.evaluate(()=>scrollY),oldScroll);
 const beforeScroll=requests.length;await scroll(0);await expect(first()).toHaveAttribute('data-event-id','21');await expect(button).toHaveCount(0);assert.equal(requests.length,beforeScroll,'returning to top applies the buffer without another request');
 await scroll(1000);await poll(22);await scroll(800);await expect(button).toBeVisible();await expect(first()).toHaveAttribute('data-event-id','21');
 await page.locator('.live-events').evaluate(el=>el.scrollIntoView({block:'start'}));await page.clock.runFor(20);await expect(first()).toHaveAttribute('data-event-id','22');await expect(button).toHaveCount(0);
 next=23;await page.clock.runFor(5000);await expect(first()).toHaveAttribute('data-event-id','23');await expect(button).toHaveCount(0);
 await scroll(1000);await poll(24);await button.click();await expect(first()).toHaveAttribute('data-event-id','24');await expect(button).toHaveCount(0);
 await scroll(1000);await poll(25);await page.getByRole('button',{name:'Pause',exact:true}).evaluate(el=>el.click());await expect(page.getByRole('button',{name:'Resume',exact:true})).toBeVisible();await scroll(0);await expect(button).toBeVisible();await expect(first()).toHaveAttribute('data-event-id','24');await page.getByRole('button',{name:'Resume',exact:true}).click();await expect(first()).toHaveAttribute('data-event-id','25');await expect(button).toHaveCount(0);
 // Filter replacement must remove the old scroll listener and its old row buffer.
 await page.getByRole('button',{name:/^Filters/}).click();await scroll(1000);await poll(26);await page.getByLabel('Live event type').evaluate(el=>{el.value='like';el.dispatchEvent(new Event('change',{bubbles:true}));});await expect(first()).toHaveAttribute('data-event-id','120');
 next=21;await scroll(1000);await page.waitForLoadState('networkidle');await page.clock.runFor(5000);await expect(button).toBeVisible();await scroll(0);await expect(first()).toHaveAttribute('data-event-id','121');await expect(button).toHaveCount(0);assert.ok((await page.locator('.live-events li').evaluateAll(rows=>rows.map(row=>Number(row.dataset.eventId)))).every(id=>id>=101));
 assert.deepEqual(errors,[]);console.log('PASS scroll-to-top: automatic buffer flush without fetching, feed/page top, continued live inserts, paused/manual behavior and filter cleanup.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
