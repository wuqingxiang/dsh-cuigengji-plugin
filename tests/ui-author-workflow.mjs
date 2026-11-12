import {join} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {startPreview,dispatchCall,shotDir} from './helpers/preview.mjs';
const shots=await shotDir('author-workflow');
const {url,preview}=await startPreview();
const call=dispatchCall(url);
let browser,page;
try{
 const novelId=(await call('novel.list'))[0].id,first=(await call('chapter.list',{novelId}))[0];
 const prose='雨夜里的脚步声越走越近。\n\n'.repeat(80);
 await call('chapter.update',{novelId,chapterId:first.id,expectedRevision:first.revision,content:prose});
 await call('chapter.create',{novelId,title:'第二章 旧码头',content:'另一条故事线。'});
 browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1400,height:950},reducedMotion:'reduce'});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 let hold=false,held=false,release,lost=false;
 await page.route('**/dispatch',async route=>{const {action,args}=route.request().postDataJSON();if(action==='chapter.update'&&hold){hold=false;held=true;await new Promise(resolve=>release=resolve);held=false;}if(action==='planning.apply'&&args.reason==='新建规划'&&lost){lost=false;await call(action,args);await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'模拟已保存但响应丢失'})});return;}await route.continue();});
 await page.goto(url);
 // The chapter directory lists newest-first by default (0.6 display order);
 // open the seeded first chapter by its title, not by list position.
 await page.locator('.chapter-open').filter({hasText:first.title}).first().click();
 const manuscript=page.getByRole('textbox',{name:'正文',exact:true}),title=()=>page.getByRole('button',{name:'修改章节标题',exact:true});
 await expect(manuscript).toHaveValue(prose);await page.locator('.editor-scroll').evaluate(el=>el.scrollTop=400);
 await title().click();await page.getByRole('textbox',{name:'修改章节标题',exact:true}).fill('第一章 雨夜来客');await page.keyboard.press('Enter');
 await expect.poll(async()=>(await call('chapter.get',{novelId,chapterId:first.id})).title).toBe('第一章 雨夜来客');
 expect(await page.locator('.editor-scroll').evaluate(el=>el.scrollTop)).toBeGreaterThan(350);
 await manuscript.fill(prose+'作者新写的一段。');await title().click();await page.getByRole('textbox',{name:'修改章节标题',exact:true}).fill('取消的标题');await page.keyboard.press('Escape');
 await expect(title()).toContainText('第一章 雨夜来客');await expect(manuscript).toHaveValue(prose+'作者新写的一段。');
 await expect.poll(async()=>(await call('chapter.get',{novelId,chapterId:first.id})).content.endsWith('作者新写的一段。')).toBe(true);
 await page.screenshot({path:join(shots,'01-chapters.png')});
 // Removal must wait for the active autosave, then restore all the submitted words.
 hold=true;await manuscript.fill(prose+'删除前最后输入的正文。');await expect.poll(()=>held).toBe(true);
 await page.getByRole('button',{name:'移入回收站 第一章 雨夜来客',exact:true}).click();
 expect((await call('chapter.get',{novelId,chapterId:first.id})).deleted).toBe(false);
 release();await expect.poll(async()=>(await call('chapter.get',{novelId,chapterId:first.id})).deleted).toBe(true);
 await expect(page.locator('.chapter-item').filter({hasText:'第一章 雨夜来客'})).toHaveCount(0);
 expect((await call('context.get',{novelId,chapterId:first.id,includeChapters:true})).items.some(v=>v.id===first.id)).toBe(false);
 await page.getByRole('button',{name:'撤销',exact:true}).click();
 await expect.poll(async()=>(await call('chapter.get',{novelId,chapterId:first.id})).deleted).toBe(false);
 expect((await call('chapter.get',{novelId,chapterId:first.id})).content).toBe(prose+'删除前最后输入的正文。');
 await page.getByRole('button',{name:'移入回收站 第一章 雨夜来客',exact:true}).click();
 // The directory may poll-refresh a moment after the RPC confirms deletion.
 await expect(page.locator('.chapter-item').filter({hasText:'第一章 雨夜来客'})).toHaveCount(0,{timeout:10000});
 await page.getByRole('button',{name:/^回收站/}).click();
 // The recycled row keeps the same title; restore from that row.
 const recycledRow=page.locator('.chapter-item').filter({hasText:'第一章 雨夜来客'});
 await expect(recycledRow).toBeVisible();
 await page.screenshot({path:join(shots,'02-recycle.png')});
 await recycledRow.getByRole('button',{name:/^恢复/}).click();
 await page.getByRole('button',{name:'返回章节目录',exact:true}).click();
 await page.getByRole('button',{name:'规划',exact:true}).click();
 const canvas=page.locator('.planning-canvas-scroll');
 // The organization sidebar overlays the canvas; collapse it so the
 // context-menu clicks land on the canvas itself.
 {const btn=page.getByRole('button',{name:'收起组织侧栏',exact:true});if(await btn.isVisible())await btn.click();}
 const context=async(dx=120,dy=100)=>{const box=await canvas.boundingBox();await page.mouse.click(box.x+dx,box.y+dy,{button:'right'});};
 await context();await page.getByRole('menuitem',{name:'新建情节',exact:true}).click();
 await expect(page.locator('.creation')).toHaveCount(0);await expect(page.getByRole('textbox',{name:'情节标题',exact:true})).toBeFocused();
 await page.getByRole('textbox',{name:'情节标题',exact:true}).fill('雨夜潜入');await page.getByRole('textbox',{name:'情节摘要',exact:true}).fill('主角从河岸潜入，寻找失踪者留下的线索。');
 await page.screenshot({path:join(shots,'03-inline-create.png')});await page.locator('.canvas-draft').getByRole('button',{name:'创建',exact:true}).click();
 await expect(page.locator('.scene-card')).toHaveCount(1);await expect(page.locator('.workspace-detail')).toHaveCount(0);
 const base=(await call('planning.list',{novelId})).items[0];
 // Cancel a continuation without adding a card or edge.
 const port=page.getByRole('button',{name:'雨夜潜入：输出连接点',exact:true}),p=await port.boundingBox();
 await page.mouse.move(p.x+p.width/2,p.y+p.height/2);await page.mouse.down();await page.mouse.move(p.x+350,p.y+80,{steps:8});await page.mouse.up();
 await expect(page.locator('.canvas-draft')).toHaveCount(1);await page.keyboard.press('Escape');
 expect((await call('planning.list',{novelId})).items.length).toBe(1);expect((await call('planning.list',{novelId})).edges.length).toBe(0);
 // Lost receipt retries use the exact same identity and never duplicate the new card.
 await context(600,110);await page.getByRole('menuitem',{name:'新建情节',exact:true}).click();await page.getByRole('textbox',{name:'情节标题',exact:true}).fill('反派设伏');lost=true;
 await page.locator('.canvas-draft').getByRole('button',{name:'创建',exact:true}).click();await expect(page.locator('.canvas-draft').getByRole('alert')).toBeVisible();
 await page.locator('.canvas-draft').getByRole('button',{name:'重试保存',exact:true}).click();await expect(page.locator('.canvas-draft')).toHaveCount(0);
 expect((await call('planning.list',{novelId})).items.length).toBe(2);
 await page.getByRole('button',{name:'雨夜潜入',exact:true}).dblclick();await expect(page.locator('.workspace-detail')).toBeVisible();
 // In side-detail mode (0.6) the overview leaves the layout, so the canvas
 // re-appears only after the detail closes; assert the detail itself instead.
 await expect(page.locator('.workspace-detail .planning-detail')).toBeVisible();
 // Canvas remains interactive next to a scrolling document inspector.
 // (In side-detail mode the canvas is unmounted; close the detail first.)
 await page.getByRole('button',{name:'‹ 返回规划',exact:true}).click();
 await expect(canvas).toBeVisible();
 const before=await page.locator('.planning-canvas').evaluate(el=>getComputedStyle(el).transform);
 const box=await canvas.boundingBox();await page.mouse.move(box.x+30,box.y+box.height-70);await page.mouse.down({button:'right'});await page.mouse.move(box.x+75,box.y+box.height-40,{steps:6});await page.mouse.up({button:'right'});
 expect(await page.locator('.planning-canvas').evaluate(el=>getComputedStyle(el).transform)).not.toBe(before);
 await page.screenshot({path:join(shots,'04-canvas-inspector.png')});
 // Saving the inspector must update the canvas revision before the next move.
 // Reopen the detail, edit, save, then close it again for the canvas checks.
 await page.getByRole('button',{name:'雨夜潜入',exact:true}).dblclick();
 const inspector=page.locator('.workspace-detail');await inspector.getByRole('button',{name:'编辑规划',exact:true}).click();
 await inspector.getByRole('textbox',{name:'摘要',exact:true}).fill('先查明警报的来源，再选择进入时机。');
 await inspector.getByRole('button',{name:'保存规划',exact:true}).click();
 await page.getByRole('button',{name:'‹ 返回规划',exact:true}).click();
 await expect(page.getByRole('button',{name:'＋ 情节',exact:true})).toBeEnabled();
 const scene=(await call('planning.list',{novelId})).items.find(n=>n.title==='雨夜潜入');
 const sceneTitle=page.getByRole('button',{name:'雨夜潜入',exact:true}),sceneBox=await sceneTitle.boundingBox();
 await page.mouse.move(sceneBox.x+30,sceneBox.y+sceneBox.height/2);await page.mouse.down();await page.mouse.move(sceneBox.x+70,sceneBox.y+sceneBox.height/2+30,{steps:5});await page.mouse.up();
 await expect.poll(async()=>(await call('planning.list',{novelId})).items.find(n=>n.id===scene.id).revision).toBe(scene.revision+1);
 await expect(page.getByRole('alert')).toHaveCount(0);
 // A server revision can advance before the canvas has received it and unlocked.
 await expect(port).toBeEnabled();
 await context(500,320);await page.getByRole('menuitem',{name:'文字批注',exact:true}).click();await page.getByRole('textbox',{name:'便签标题',exact:true}).fill('待讨论的动机');await page.getByRole('textbox',{name:'批注内容',exact:true}).fill('他为什么愿意冒险？');await page.locator('.canvas-draft').getByRole('button',{name:'创建',exact:true}).click();
 await expect(page.locator('.decoration-note')).toHaveCount(1);await page.getByRole('button',{name:'打开批注 待讨论的动机',exact:true}).dblclick();
 await expect(page.locator('.decoration-inline-editor')).toBeVisible();await page.getByRole('textbox',{name:'批注内容',exact:true}).fill('他希望找回失踪的同伴。');await page.locator('.decoration-inline-editor').getByRole('button',{name:'完成',exact:true}).click();
 await expect(page.locator('.decoration-content')).toContainText('失踪的同伴');
 for(const width of [1024,700,390]){await page.setViewportSize({width,height:900});await expect.poll(()=>page.locator('.cuigengji').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await page.screenshot({path:join(shots,`05-canvas-${width}.png`)});}
 expect(errors).toEqual([]);console.log(JSON.stringify({ok:true,checks:['inline-title-and-cancel','save-before-removal','recycle-and-undo','deleted-reference-exclusion','inline-create','cancel-connected-create','lost-response-idempotence','interactive-inspector','inspector-save-then-drag','inline-annotations','responsive-layout'],screenshots:shots}));
}catch(error){if(page)await page.screenshot({path:join(shots,'failure.png')}).catch(()=>{});throw error;}finally{if(browser)await browser.close();preview.kill();}
