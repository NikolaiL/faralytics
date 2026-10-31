const assert=require('node:assert/strict');
const{chromium,expect}=require('@playwright/test');
const base=process.env.BASE_URL||'http://localhost:3100';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
 try{
  const page=await browser.newPage({viewport:{width:390,height:850}});
  let release,hold=true;
  const requests=[];
  const profiles={1:{fid:'1',username:'alice',display_name:null},2:{fid:'2',username:'bob',display_name:null},3:{fid:'3',username:'carol',display_name:null}};
  await page.route('**/api/lookup-log',r=>r.fulfill({json:{}}));
  await page.route('**/api/search?*',r=>r.fulfill({json:[{...profiles[1],followerCount:100}]}));
  await page.route('**/api/follow-timeline?*',async r=>{
   const p=new URL(r.request().url()).searchParams;
   requests.push(p);
   if(hold&&p.get('actor')&&p.get('target'))await new Promise(resolve=>{release=resolve;});
   if(p.get('actor')==='1'&&p.get('target')==='alias') {await r.fulfill({json:{events:[],filters:{actor:profiles[1],target:null},headCursor:null,nextCursor:null,hasMore:false,updatedAt:new Date().toISOString()}});return;}
   await r.fulfill({json:{events:[],filters:{actor:profiles[p.get('actor')]||(p.get('actor')?.toLowerCase()==='@alice'?profiles[1]:null),target:profiles[p.get('target')]||null},headCursor:null,nextCursor:null,hasMore:false,updatedAt:new Date().toISOString()}});
  });
  await page.goto(base+'/follow-timeline?target=2');
  await expect(page.getByTestId('timeline-target-input')).toHaveValue('@bob');
  await page.getByTestId('timeline-actor-input').fill('1');await page.getByTestId('timeline-actor-submit').click();
  await expect(page.getByTestId('timeline-actor-spinner')).toBeVisible();
  await expect(page.getByTestId('timeline-target-spinner')).toHaveCount(0);
  await expect(page.getByTestId('timeline-target-clear')).toBeVisible();
  await expect(page.getByTestId('timeline-target-input')).toBeEnabled();
  await expect(page.getByTestId('timeline-target-input')).toHaveValue('@bob');
  await page.getByTestId('timeline-target-input').fill('unfinished target');
  assert.ok(release);release();
  await expect(page.getByTestId('timeline-actor-input')).toHaveValue('@alice');
  await expect(page.getByTestId('timeline-target-input')).toHaveValue('unfinished target');
  await page.getByTestId('timeline-target-input').fill('3');await page.getByTestId('timeline-target-submit').click();
  await expect(page.getByTestId('timeline-target-spinner')).toBeVisible();
  await expect(page.getByTestId('timeline-actor-spinner')).toHaveCount(0);
  await expect(page.getByTestId('timeline-actor-clear')).toBeVisible();
  await expect(page.getByTestId('timeline-actor-input')).toBeEnabled();
  await expect(page.getByTestId('timeline-actor-input')).toHaveValue('@alice');
  await page.getByTestId('timeline-actor-input').fill('unfinished actor');
  release();
  await expect(page.getByTestId('timeline-target-input')).toHaveValue('@carol');
  await expect(page.getByTestId('timeline-actor-input')).toHaveValue('unfinished actor');
  hold=false;
  for(const [role,other,value] of [['target','actor','1'],['actor','target','@ALICE']]){
   await page.getByTestId(`timeline-${role}-input`).fill(value);
   await page.getByTestId(`timeline-${role}-submit`).click();
   await expect(page.getByTestId(`timeline-${role}-input`)).toHaveValue('@alice');
   await expect(page.getByTestId(`timeline-${other}-input`)).toHaveValue('');
   await expect.poll(()=>new URL(page.url()).search).toBe('?'+role+'=1');
  }
  await page.getByTestId('timeline-target-input').fill('alice');
  await page.getByTestId('timeline-target-result').click();
  await expect(page.getByTestId('timeline-target-input')).toHaveValue('@alice');
  await expect(page.getByTestId('timeline-actor-input')).toHaveValue('');
  await expect.poll(()=>new URL(page.url()).search).toBe('?target=1');
  assert.ok(requests.every(p=>!p.get('actor')||p.get('actor')!==p.get('target')),'same account moves fields without requesting a self-follow filter');
  await page.getByTestId('timeline-actor-input').fill('1');await page.getByTestId('timeline-actor-submit').click();await expect.poll(()=>new URL(page.url()).search).toBe('?actor=1');
  await page.getByTestId('timeline-target-input').fill('alias');await page.getByTestId('timeline-target-submit').click();
  await expect(page.getByTestId('timeline-target-input')).toHaveValue('@alice');await expect(page.getByTestId('timeline-actor-input')).toHaveValue('');await expect.poll(()=>new URL(page.url()).search).toBe('?target=1');
  console.log('PASS same account moves to the last edited field via FID, case-insensitive username and autocomplete; previous field and URL filter clear.');
  console.log('PASS independent timeline field loading in both directions: settled field retains value/reset control and stays usable; in-progress drafts survive the other lookup.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
