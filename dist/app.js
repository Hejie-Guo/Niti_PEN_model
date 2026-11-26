(()=>{
'use strict';
const D=globalThis.MODEL_DATA,M=globalThis.FatigueModel,$=id=>document.getElementById(id);
const state={version:'full',mode:'life',view:'pen',e:4.5,p:90,n:3000,showData:true,confidence:true,compare:false,page:0,query:'',onlyFit:false};
let unifiedVersion='full',projectVersion='WIN';
const COLORS={50:'#416d9f',90:'#c77a55',95:'#578c7e',99:'#8b78aa',custom:'#294c79',characteristic:'#1c7d86'};
const nf=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:0});
const number=(n,d=0)=>Number.isFinite(n)?n.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const percent=(n,d=1)=>Number.isFinite(n)?(n*100).toFixed(d)+'%':'—';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pending=false,activePoints=[],timer;
function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;render()})}
function model(){return D.models[state.version]}
function isCharacteristic(p=state.p/100){return Number.isFinite(p)&&Math.abs(p-M.CHARACTERISTIC_SURVIVAL)<1e-10}
function selectModel(key){state.version=key;if(D.models[key].project)projectVersion=key;else unifiedVersion=key;state.page=0;state.query='';$('data-search').value='';schedule()}
function calculation(){const m=model(),p=state.p/100;if(!M.validP(p))return {valid:false,reason:'请输入大于0且小于100的生存率。'};
 if(state.mode==='life'){const e=state.e/100;if(!Number.isFinite(e)||e<=0)return {valid:false,reason:'请输入大于0的仿真最大应变。'};return {valid:true,e,n:M.lifetime(m,e,p),p}}
 if(!Number.isFinite(state.n)||state.n<=0)return {valid:false,reason:'请输入大于0的目标寿命。'};
 const e=M.strain(m,state.n,p);return {valid:Number.isFinite(e)&&e>0,e,n:state.n,p,reason:'当前条件下反算应变不稳定，请调整输入。'};
}
function toast(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>{$('toast').hidden=true},2600)}
function download(content,name,type='text/csv;charset=utf-8'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function updateCalc(){
 const m=model(),c=calculation();
 $('strain-controls').hidden=state.mode!=='life';$('life-controls').hidden=state.mode!=='strain';
 $('result-label').textContent=state.mode==='life'?(isCharacteristic()?'Weibull 特征寿命 η':'预测循环寿命'):'模型反算应变';$('result-unit').textContent=state.mode==='life'?'次':'%';
 $('strain-slider').min=(m.emin*100).toFixed(3);$('strain-slider').max=(m.emax*100).toFixed(3);$('strain-slider').value=Math.min(m.emax*100,Math.max(m.emin*100,state.e));
 $('range-min').textContent=(m.emin*100).toFixed(2)+'%';$('range-max').textContent=(m.emax*100).toFixed(2)+'%';
 document.querySelectorAll('[data-p]').forEach(b=>{const selected=b.hasAttribute('data-characteristic')?isCharacteristic():Math.abs(Number(b.dataset.p)-state.p)<1e-8;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected))});
 $('sensitivity').hidden=state.version!=='window';
 if(!c.valid||!Number.isFinite(c.n)){
  $('result-value').textContent='—';$('result-subtitle').textContent='填写有效输入后计算';$('result-ci').textContent='';$('input-message').textContent=c.reason||'当前输入超出可计算范围。';$('domain-message').textContent='拟合应变范围 '+(m.emin*100).toFixed(2)+'%–'+(m.emax*100).toFixed(2)+'%';$('conditional-result').textContent='—';return;
 }
 $('result-value').textContent=state.mode==='life'?number(c.n):number(c.e*100,3);
 $('result-subtitle').textContent=state.mode==='life'?`${number(state.p,Number.isInteger(state.p)?0:1)}% 生存率 · ${number(100-state.p,Number.isInteger(state.p)?0:1)}% 失效分位`:`目标寿命 ${number(c.n)} 次 · ${number(state.p,1)}% 生存率`;
 if(isCharacteristic())$('result-subtitle').textContent=state.mode==='life'?'特征概率 · 生存率36.7879% · 累计失效63.2121%':`目标特征寿命 ${number(c.n)} 次 · R=e⁻¹`;
 if(state.mode==='life'){const ci=M.interval(m,c.e,c.p);$('result-ci').textContent=`参数估计95%区间：${number(ci[0])}–${number(ci[1])} 次`}
 else{
  const q=m.bootstrap.map(b=>M.strain({eta0:Math.exp(b[0]),m:b[1],k:Math.exp(b[2])},c.n,c.p)).sort((a,b)=>a-b);
  const ci=[M.quantile(q,.025)*100,M.quantile(q,.975)*100];
  $('result-ci').textContent=ci.every(Number.isFinite)?`参数估计95%区间：${number(ci[0],3)}%–${number(ci[1],3)}%`:'参数区间过宽，反算应变不稳定';
 }
 const outside=c.e<m.emin-1e-10||c.e>m.emax+1e-10;
 $('domain-message').textContent=outside?'当前结果属于应变范围外推':'位于拟合应变范围内';
 $('domain-message').style.color=outside?'#b0864c':'';
 const warnings=[];
 if(outside)warnings.push(`拟合应变范围为 ${(m.emin*100).toFixed(2)}%–${(m.emax*100).toFixed(2)}%，当前为外推估计。`);
 if(state.version==='window'&&(c.n<2000||c.n>8000))warnings.push('该名义寿命超出2,000–8,000次筛选窗口，尾部尚未验证。');
 $('input-message').textContent=warnings.join(' ');
 if(state.version==='window')$('conditional-result').textContent=c.e>=D.truncated.emin&&c.e<=D.truncated.emax?number(M.truncated(D.truncated,c.e,c.p))+' 次':'当前应变超出敏感性模型拟合范围';
}
function updateOverview(){
 const m=model(),v=m.metrics,project=m.project;
 $('unified-options').hidden=!!project;$('project-options').hidden=!project;
 document.querySelectorAll('[data-scope]').forEach(b=>{const on=b.dataset.scope===(project?'project':'unified');b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))});
 $('model-type-label').textContent=project?'分项目独立模型':'统一归一化模型';
 $('parameter-model-title').textContent=project?project+' 项目独立模型':'统一归一化模型';
 $('parameter-model-description').textContent=project?'仅使用该项目的完整寿命范围数据，未按2,000–8,000次筛选。':'不同产品共用一组系数，不设置产品修正项。';
 $('unified-comparison').hidden=!!project;
 $('compare-label').textContent=project?'对照完整统一模型 N50':'对照另一版本 N50';
 $('data-heading').textContent=project?project+' 项目数据与纳入记录':'两个版本的数据，都在这里';
 $('analysis-report-link').href=project?'assets/project-analysis-report.html':'assets/analysis-report.html';
 $('analysis-report-link').textContent=project?'分项目分析报告':'完整分析报告';
 $('method-report-link').href=project?'assets/project-analysis-report.html':'assets/analysis-report.html';
 $('workbook-link').href=project?'assets/project-fatigue-models.xlsx':'assets/fatigue-models.xlsx';
 document.querySelectorAll('[data-version]').forEach(b=>{const on=b.dataset.version===state.version;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))});
 document.querySelectorAll('[data-mode]').forEach(b=>{const on=b.dataset.mode===state.mode;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))});
 $('version-description').textContent=project?project+' 独立拟合 · 完整寿命范围':state.version==='window'?'仅使用窗口内有应变的逐件记录':'使用全部有应变记录，保留右删失信息';
 $('metric-n').innerHTML=number(m.n)+'<em>件</em>';$('metric-retained').textContent=`保留 ${m.rawCount} 条寿命记录`;
 $('metric-levels').innerHTML=number(m.levels)+'<em>组</em>';$('metric-domain').textContent=`ε ${(m.emin*100).toFixed(2)}%–${(m.emax*100).toFixed(2)}%`;
 $('metric-error').textContent=percent(v.mdape);$('metric-r2').textContent=v.r2_log.toFixed(4);
 $('metric-r2-note').textContent=project?project+' 项目留出预测表现':state.version==='window'?'应变带来的解释力很弱':'完整数据的整体预测表现';
 $('model-equation').innerHTML=`N<sub>P</sub> = ${number(m.eta0,2)} × (ε / 0.045)<sup>−${m.m.toFixed(6)}</sup> × (−ln P)<sup>1/${m.k.toFixed(6)}</sup>`;
 $('accuracy-15').textContent=percent(v.within15);$('accuracy-2').textContent=percent(v.within2);$('rmse').textContent=v.rmse_log10.toFixed(4);
 $('validation-caption').textContent=`${m.levels} 折 · ${m.n} 条留出记录 · ${m.failures} 条已失效记录计点误差`;
 $('interpretation-title').textContent=state.version==='window'?'误差较小，解释力仍然有限':'同一模型，覆盖全部寿命范围';
 $('interpretation-text').textContent=state.version==='window'?'筛选后，寿命范围已被收窄。统一模型的大部分预测集中在4,500次左右；高命中率不能替代对寿命变化的解释。':'完整版保留低应变下的长寿命信息，并在最大似然拟合中正确处理3条未失效停机记录。它与筛选版对应的评价总体不同。';
 $('evidence-line').textContent=state.version==='window'?'相对无应变基线的RMSE增益：0.00269，95%区间跨过零。':'在相同162件上，完整版中位误差26.6%，筛选版14.7%。';
 if(project){
  const notes={
   WIN:['WIN：端点工况存在趋势偏差','使用35件、7个应变水平独立拟合。对数寿命预测R²接近零，端点工况与单斜率幂律仍有偏差。','趋势失拟检验经Holm校正 p=0.036，当前曲线用于经验估算。'],
   BE:['BE：P90的留出校准偏乐观','使用50件试件，其中3件20,000次为停机未失效，已按右删失处理。P90曲线在留出记录中的实际存活比例为86.0%。','名义90%生存率目前不足以认定达到90%可靠度。'],
   THK:['THK：当前项目点预测误差较小','保留50条寿命记录，其中40件有明确应变用于独立拟合。两个带“+”条件的10件缺少应变，继续保留原始记录。','本次40件均落在2倍误差范围内，不代表总体预测准确率为100%。'],
   LK:['LK：高应变端存在趋势变化','使用69件、11个应变水平独立拟合。高应变端的寿命变化并不完全符合单斜率幂律，单一曲线存在趋势失拟。','趋势失拟检验经Holm校正 p=0.004，分组验证详见项目分析报告。']
  };
  [$('interpretation-title').textContent,$('interpretation-text').textContent,$('evidence-line').textContent]=notes[project];
 }
 const pr=m.parameterCI;
 $('parameters-body').innerHTML=[['η₀ · 特征寿命',number(m.eta0,2)+' 次',`${number(pr.eta0[0],2)}–${number(pr.eta0[1],2)}`],['m · 应变指数',m.m.toFixed(6),`${pr.m[0].toFixed(4)}–${pr.m[1].toFixed(4)}`],['k · Weibull形状',m.k.toFixed(6),`${pr.k[0].toFixed(4)}–${pr.k[1].toFixed(4)}`],['c · 经验指数',m.c.toFixed(6),'由 −1/m 换算']].map(r=>'<tr>'+r.map(t=>`<td>${safe(t)}</td>`).join('')+'</tr>').join('');
 $('project-comparison-body').innerHTML=D.projectOrder.map(key=>{const p=D.models[key],mv=p.metrics;return `<tr${state.version===key?' class="highlight"':''}><td><button class="project-load" data-project="${key}">${key}</button></td><td>${p.n}</td><td>${number(p.eta0,1)}</td><td>${p.m.toFixed(4)}</td><td>${p.k.toFixed(4)}</td><td>${percent(p.emin,2)}–${percent(p.emax,2)}</td><td>${percent(mv.mdape)}</td><td>${mv.r2_log.toFixed(4)}</td><td>${percent(mv.R90_observed)}</td></tr>`}).join('');
}
function comparison(){const c=D.comparison;
 const rows=[['筛选版统一模型',c.filtered,state.version==='window'],['无应变的统一基线',c.baseline,false],['完整数据版统一模型',c.fullMatched,state.version==='full'],['双截断条件模型',c.truncated,false]];
 $('comparison-body').innerHTML=rows.map(([name,m,on])=>`<tr${on?' class="highlight"':''}><td>${name}${on?' · 当前主模型':''}</td><td class="number">${percent(m.mdape)}</td><td>${m.rmse_log10.toFixed(4)}</td><td>${m.r2_log.toFixed(4)}</td><td>${percent(m.within2)}</td></tr>`).join('');
}
function updateData(){
 const all=M.rows(D,state.version),fit=all.filter(r=>r.included).length;
 let list=state.onlyFit?all.filter(r=>r.included):all;
 const q=state.query.trim().toLowerCase();if(q)list=list.filter(r=>(r.id+' '+r.condition+' '+r.source_cell).toLowerCase().includes(q));
 const pages=Math.max(1,Math.ceil(list.length/10));state.page=Math.min(state.page,pages-1);
 const shown=list.slice(state.page*10,state.page*10+10);
 $('data-count').innerHTML=`保留 <strong>${all.length}</strong> 条记录，<strong>${fit}</strong> 条参与拟合`;
 $('records-body').innerHTML=shown.length?shown.map(r=>`<tr><td>${safe(r.id)}</td><td>${safe(r.condition)}</td><td>${r.strain===null?'未提供':percent(r.strain,3)}</td><td class="number">${r.event?'':'≥ '}${number(r.life)}${String(r.raw_value).includes('*')?'*':''}</td><td><span class="record-status${r.event?'':' censored'}">${r.event?'已失效':'右删失'}</span></td><td class="${r.included?'':'record-exclusion'}">${r.included?'参与拟合':'缺少应变，保留记录'}</td></tr>`).join(''):'<tr><td colspan="6">没有找到符合条件的记录。</td></tr>';
 $('page-summary').textContent=list.length?`${state.page*10+1}–${Math.min((state.page+1)*10,list.length)} / ${list.length} 条`:'0 条记录';
 $('previous-page').disabled=state.page===0;$('next-page').disabled=state.page>=pages-1;
}
const E=(tag,attrs={},text='')=>`<${tag} ${Object.entries(attrs).map(([k,v])=>`${k}="${safe(v)}"`).join(' ')}>${text}</${tag}>`;
const line=(x1,y1,x2,y2,attrs={})=>E('line',{x1,y1,x2,y2,...attrs});
const text=(x,y,value,attrs={})=>E('text',{x,y,fill:'#8a9bb0','font-size':13,'font-family':'Segoe UI, Microsoft YaHei, sans-serif',...attrs},safe(value));
function niceTicks(min,max,count=5){const raw=(max-min)/count,p=Math.pow(10,Math.floor(Math.log10(raw))),steps=[1,2,2.5,5,10];const step=(steps.find(v=>v*p>=raw)||10)*p;const out=[];for(let t=Math.ceil(min/step)*step;t<=max+step*1e-7;t+=step)out.push(+t.toFixed(12));return out}
function logTicks(min,max,width){const out=[];for(let n=Math.floor(Math.log10(min));n<=Math.ceil(Math.log10(max));n++)for(const b of [1,2,5]){const v=b*Math.pow(10,n);if(v>=min&&v<=max)out.push(v)}
 const limit=Math.max(3,Math.floor(width/100));if(out.length>limit)return out.filter((_,i)=>i%Math.ceil(out.length/limit)===0);return out;
}
function plotBase({xmin,xmax,ymin,ymax,xlog=false,ylog=false,xlabel,ylabel,xticks,yticks,formatX=x=>number(x),formatY=y=>number(y,1)}){
 const width=Math.max(270,$('chart-container').clientWidth),height=width<470?330:Math.min(440,Math.max(345,width*.56));
 const box={l:61,r:18,t:22,b:57},pw=width-box.l-box.r,ph=height-box.t-box.b;
 const fx=xlog?Math.log10:x=>x,fy=ylog?Math.log10:y=>y;
 const X=x=>box.l+(fx(x)-fx(xmin))/(fx(xmax)-fx(xmin))*pw,Y=y=>box.t+ph-(fy(y)-fy(ymin))/(fy(ymax)-fy(ymin))*ph;
 const xs=xticks||(xlog?logTicks(xmin,xmax,pw):niceTicks(xmin,xmax,width<470?3:5));
 const ys=yticks||(ylog?logTicks(ymin,ymax,ph):niceTicks(ymin,ymax,5));
 let grid=E('defs',{},E('clipPath',{id:'plot-clip'},E('rect',{x:box.l,y:box.t,width:pw,height:ph})));
 xs.forEach(x=>{grid+=line(X(x),box.t,X(x),height-box.b,{stroke:'#e9eef5','stroke-dasharray':'3 5'});grid+=text(X(x),height-box.b+24,formatX(x),{'text-anchor':'middle'})});
 ys.forEach(y=>{grid+=line(box.l,Y(y),width-box.r,Y(y),{stroke:'#e9eef5','stroke-dasharray':'3 5'});grid+=text(box.l-11,Y(y)+4,formatY(y),{'text-anchor':'end'})});
 grid+=line(box.l,height-box.b,width-box.r,height-box.b,{stroke:'#dce4ee'});grid+=line(box.l,box.t,box.l,height-box.b,{stroke:'#dce4ee'});
 grid+=text(box.l+pw/2,height-9,xlabel,{'text-anchor':'middle','font-size':14,fill:'#8a9bb0'});
 grid+=text(16,box.t+ph/2,ylabel,{'text-anchor':'middle',transform:`rotate(-90 16 ${box.t+ph/2})`,'font-size':14,fill:'#8a9bb0'});
 return {width,height,box,pw,ph,X,Y,grid,xmin,xmax,ymin,ymax};
}
function pathOf(points,X,Y){return points.map((p,i)=>`${i?'L':'M'}${X(p[0]).toFixed(2)},${Y(p[1]).toFixed(2)}`).join(' ')}
function path(points,b,attrs={}){return E('path',{d:pathOf(points,b.X,b.Y),fill:'none','stroke-linejoin':'round','stroke-linecap':'round',...attrs})}
function legend(items){$('chart-legend').innerHTML=items.map(i=>`<span class="legend-item">${i.dot?'<i class="legend-dot" style="background:'+i.color+'"></i>':'<i class="legend-line" style="background:'+i.color+'"></i>'}${safe(i.label)}</span>`).join('')}
function showSvg(b,shapes,label){$('main-chart').setAttribute('viewBox',`0 0 ${b.width} ${b.height}`);$('main-chart').setAttribute('height',b.height);$('main-chart').setAttribute('aria-label',label);$('main-chart').innerHTML=b.grid+E('g',{'clip-path':'url(#plot-clip)'},shapes)}
function marker(b,x,y){if(!Number.isFinite(x)||!Number.isFinite(y)||x<b.xmin||x>b.xmax||y<b.ymin||y>b.ymax)return '';
 return line(b.X(x),b.Y(y),b.X(x),b.height-b.box.b,{stroke:'#7ca5cb','stroke-dasharray':'4 5'})+line(b.box.l,b.Y(y),b.X(x),b.Y(y),{stroke:'#7ca5cb','stroke-dasharray':'4 5'})+E('circle',{cx:b.X(x),cy:b.Y(y),r:6,fill:'#315e8d',stroke:'white','stroke-width':2});
}
function renderPen(){const m=model(),c=calculation(),p=c.valid?c.p:.9;
 const eps=Array.from({length:61},(_,i)=>m.emin+(m.emax-m.emin)*i/60),ps=[.5,.9,.95,.99];if(!ps.some(q=>Math.abs(q-p)<1e-8))ps.push(p);
 const series=ps.map(q=>({p:q,pts:eps.map(e=>[M.lifetime(m,e,q),e*100])}));
 const raw=M.rows(D,state.version,true);activePoints=raw.map(r=>({...r,tip:`${r.id}\n应变 ${percent(r.strain,3)}\n${r.event?'失效寿命':'停机未失效 ≥'} ${number(r.life)} 次`}));
 const bounds=series.flatMap(s=>s.pts.map(r=>r[0]));if(state.showData)bounds.push(...raw.map(r=>r.life));
 const ci=state.confidence?eps.map(e=>M.interval(m,e,p)):null;if(ci)bounds.push(...ci.flat());
 const xmin=Math.max(.00001,Math.min(...bounds)*.88),xmax=Math.max(...bounds)*1.12;
 const b=plotBase({xmin,xmax,ymin:m.emin*100-(m.emax-m.emin)*5,ymax:m.emax*100+(m.emax-m.emin)*5,xlog:true,xlabel:'循环寿命 N / 次（对数坐标）',ylabel:'仿真最大应变 ε / %',formatX:x=>number(x),formatY:y=>number(y,1)+'%'});
 let shapes='';
 if(ci){const pts=eps.map((e,i)=>[ci[i][0],e*100]).concat(eps.map((e,i)=>[ci[i][1],e*100]).reverse());shapes+=E('path',{d:pathOf(pts,b.X,b.Y)+' Z',fill:'#dce8f4','fill-opacity':.7,stroke:'none'})}
 if(state.showData)activePoints.forEach((r,i)=>{if(r.event)shapes+=E('circle',{cx:b.X(r.life),cy:b.Y(r.strain*100),r:3.3,fill:'#99aabf','fill-opacity':.58,'data-point':i});else{shapes+=E('path',{d:`M${b.X(r.life)-4},${b.Y(r.strain*100)-4} l8,4 -8,4 Z`,fill:'#b68b60','data-point':i});shapes+=line(b.X(r.life),b.Y(r.strain*100),b.X(r.life)+12,b.Y(r.strain*100),{stroke:'#b68b60'})}});
 const items=[];
 series.forEach(s=>{const characteristic=isCharacteristic(s.p),key=Math.round(s.p*100),color=characteristic?COLORS.characteristic:COLORS[key]||COLORS.custom;const selected=Math.abs(s.p-p)<1e-8;const dash=characteristic||s.p===.5?'':s.p===.9?'8 5':s.p===.95?'3 4':'8 4 2 4';shapes+=path(s.pts,b,{stroke:color,'stroke-width':selected?2.7:1.7,'stroke-dasharray':dash});items.push({label:(characteristic?'特征寿命 η · P36.79':`P${number(s.p*100,Number.isInteger(s.p*100)?0:1)}`)+(selected?' · 当前':''),color})});
 if(state.compare){const other=D.models[m.project?'full':state.version==='window'?'full':'window'];const lo=Math.max(m.emin,other.emin),hi=Math.min(m.emax,other.emax);const pts=Array.from({length:61},(_,i)=>{const e=lo+(hi-lo)*i/60;return[M.lifetime(other,e,.5),e*100]});shapes+=path(pts,b,{stroke:'#9eacba','stroke-width':1.7,'stroke-dasharray':'5 5'});items.push({label:m.project?'完整统一模型 N50':'另一版本 N50',color:'#9eacba'})}
 if(c.valid)shapes+=marker(b,c.n,c.e*100);
 if(state.showData)items.push({label:'实测记录',color:'#99aabf',dot:true});
 showSvg(b,shapes,m.project?m.project+' 项目概率应变寿命曲线':'统一概率应变寿命曲线');legend(items);
 $('chart-note').textContent=state.confidence?'阴影为当前生存率曲线的逐点参数95%置信带，反映参数估计不确定性；不包含单个试件的全部离散性。':'曲线只绘制在当前版本的拟合应变范围内。P为模型名义生存率；实测点不按产品分组。';
}
function renderNormalized(){const m=model(),c=calculation(),raw=M.rows(D,state.version,true),km=M.km(raw,m);activePoints=[];
 const zmax=Math.max(1.65,...km.map(p=>p[0]))*1.1;
 const b=plotBase({xmin:0,xmax:zmax,ymin:0,ymax:1.03,xlabel:'归一化寿命 Z = (N/η₀)Xᵐ',ylabel:'生存概率 R',formatX:x=>number(x,1),formatY:y=>percent(y,0),yticks:[0,.2,.4,.6,.8,1]});
 let shapes=path(Array.from({length:180},(_,i)=>{const z=zmax*i/179;return[z,Math.exp(-Math.pow(z,m.k))]}),b,{stroke:'#416d9f','stroke-width':2.6});
 if(state.showData)shapes+=path(km,b,{stroke:'#a3b1c3','stroke-width':1.6});
 if(c.valid)shapes+=marker(b,M.normalized(m,c.e,c.n),c.p);
 const items=[{label:`Weibull(k=${m.k.toFixed(4)}, η=1)`,color:'#416d9f'}];if(state.showData)items.push({label:'经验生存曲线（含删失）',color:'#a3b1c3'});
 showSvg(b,shapes,'归一化寿命的Weibull主曲线');legend(items);$('chart-note').textContent='归一化移除模型中的应变尺度。此图使用全样本拟合参数展示分布，预测能力应查看独立的整组应变留出结果。';
}
function renderValidation(){const m=model(),records=m.predictions;activePoints=records.map(r=>({...r,tip:`${r.id}\n${r.event?'实测':'停机未失效 ≥'} ${number(r.life)} 次\n留出预测 N50 ${number(r.pred50)} 次`}));
 const min=Math.min(...records.map(r=>Math.min(r.life,r.pred50)))*.84,max=Math.max(...records.map(r=>Math.max(r.life,r.pred50)))*1.16;
 const b=plotBase({xmin:min,xmax:max,ymin:min,ymax:max,xlog:true,ylog:true,xlabel:'实测寿命 / 次',ylabel:'留出预测 N50 / 次',formatX:x=>number(x),formatY:y=>number(y)});
 const pts=[[min,min/2],[max,max/2],[max,max*2],[min,min*2]];let shapes=E('path',{d:pathOf(pts,b.X,b.Y)+' Z',fill:'#eef3f9'});
 shapes+=path([[min,min],[max,max]],b,{stroke:'#8193a8','stroke-width':1.2});
 shapes+=path([[min,min/2],[max,max/2]],b,{stroke:'#adbccc','stroke-width':1,'stroke-dasharray':'3 5'})+path([[min,min*2],[max,max*2]],b,{stroke:'#adbccc','stroke-width':1,'stroke-dasharray':'3 5'});
 activePoints.forEach((r,i)=>{shapes+=r.event?E('circle',{cx:b.X(r.life),cy:b.Y(r.pred50),r:3.6,fill:'#6689b1','fill-opacity':.65,'data-point':i}):E('path',{d:`M${b.X(r.life)-4},${b.Y(r.pred50)-4} l8,4 -8,4 Z`,fill:'#b68b60','data-point':i})});
 showSvg(b,shapes,'整组应变留出预测与实测寿命比较');legend([{label:'留出预测',color:'#6689b1',dot:true},{label:'预测=实测',color:'#8193a8'},{label:'0.5–2倍范围',color:'#d7e1ed'}]);$('chart-note').textContent=`${m.levels}折整组应变留出：每折先在训练集拟合，再预测整个留出应变组；${m.n-m.failures}条删失记录不计入点误差。`;
}
function renderChart(){
 document.querySelectorAll('[data-view]').forEach(b=>{const on=b.dataset.view===state.view;b.classList.toggle('selected',on);b.setAttribute('aria-selected',String(on))});
 $('confidence-option').hidden=state.view!=='pen';$('compare-option').hidden=state.view!=='pen';$('show-data').parentElement.hidden=state.view==='validation';
 $('chart-title').textContent=state.view==='pen'?'概率寿命曲线':state.view==='normalized'?'归一化主曲线':'预测与实测寿命';
 $('chart-description').textContent=state.view==='pen'?model().label+(model().project?' · 该项目完整寿命范围':' · 所有产品统一拟合'):state.view==='normalized'?model().label+' · 应变尺度归一化后的分布':model().label+' · 整组应变留出';
 $('chart-tooltip').hidden=true;
 if(state.view==='pen')renderPen();else if(state.view==='normalized')renderNormalized();else renderValidation();
}
function render(){updateOverview();updateCalc();renderChart();comparison();updateData()}
document.querySelectorAll('[data-version]').forEach(b=>b.addEventListener('click',()=>selectModel(b.dataset.version)));
document.querySelectorAll('[data-scope]').forEach(b=>b.addEventListener('click',()=>selectModel(b.dataset.scope==='project'?projectVersion:unifiedVersion)));
$('project-comparison-body').addEventListener('click',e=>{const b=e.target.closest('[data-project]');if(b){selectModel(b.dataset.project);$('model').scrollIntoView({behavior:'smooth'})}});
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.mode;schedule()}));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.view;schedule()}));
document.querySelectorAll('[data-p]').forEach(b=>b.addEventListener('click',()=>{const characteristic=b.hasAttribute('data-characteristic');state.p=characteristic?M.CHARACTERISTIC_SURVIVAL*100:Number(b.dataset.p);$('probability-input').value=characteristic?state.p.toFixed(6):state.p;schedule()}));
$('strain-input').addEventListener('input',e=>{state.e=e.target.value===''?NaN:Number(e.target.value);schedule()});
$('strain-slider').addEventListener('input',e=>{state.e=Number(e.target.value);$('strain-input').value=state.e.toFixed(3);schedule()});
$('probability-input').addEventListener('input',e=>{state.p=e.target.value===''?NaN:Number(e.target.value);schedule()});
$('life-input').addEventListener('input',e=>{state.n=e.target.value===''?NaN:Number(e.target.value);schedule()});
for(const [id,key] of [['show-data','showData'],['show-confidence','confidence'],['compare-models','compare']])$(id).addEventListener('change',e=>{state[key]=e.target.checked;schedule()});
$('data-search').addEventListener('input',e=>{state.query=e.target.value;state.page=0;updateData()});
$('only-fit').addEventListener('change',e=>{state.onlyFit=e.target.checked;state.page=0;updateData()});
$('previous-page').addEventListener('click',()=>{state.page=Math.max(0,state.page-1);updateData()});$('next-page').addEventListener('click',()=>{state.page++;updateData()});
$('download-data').addEventListener('click',()=>{const rows=M.rows(D,state.version);const content=M.csv(rows.map(r=>[r.id,r.product,r.condition,r.strain,r.life,r.event,r.raw_value,r.source_cell,r.included?'是':'否',r.in_life_window?'是':'否',r.selection_reason]),['试件编号','原来源','销钉条件','仿真最大应变（小数）','记录寿命（次）','失效标记δ','原始值','源单元格','有应变可建模','位于2000–8000次','窗口筛选说明（对应统一筛选版）']);download(content,model().project?`${model().project}_项目数据_${rows.length}条.csv`:state.version==='full'?'完整数据_204条.csv':'2000-8000次数据_172条.csv');toast(`已导出当前模型全部 ${rows.length} 条保留记录`)});
$('export-curves').addEventListener('click',()=>{const m=model(),p=state.p/100;if(!M.validP(p)){toast('请输入有效的生存率后导出');return}const rows=Array.from({length:101},(_,i)=>{const e=m.emin+(m.emax-m.emin)*i/100;const ci=M.interval(m,e,p);return[e,e/.045,M.scale(m,e),...[.5,.9,.95,.99,p].map(q=>M.lifetime(m,e,q)),...ci]});download(M.csv(rows,['仿真最大应变（小数）','归一化X','Weibull特征寿命η','P50寿命','P90寿命','P95寿命','P99寿命',`当前P${state.p}寿命`,'当前曲线参数95%CI下限','当前曲线参数95%CI上限']),`${m.project?m.project+'_项目':state.version==='full'?'完整数据统一版':'筛选数据统一版'}_寿命曲线.csv`);toast('已导出101个应变水平的曲线与参数置信区间')});
$('main-chart').addEventListener('pointermove',ev=>{const node=ev.target.closest('[data-point]');if(!node){$('chart-tooltip').hidden=true;return}const r=activePoints[Number(node.dataset.point)];if(!r)return;const rect=$('chart-container').getBoundingClientRect();const tip=$('chart-tooltip');tip.innerHTML=r.tip.split('\n').map(safe).join('<br>');tip.hidden=false;tip.style.left=Math.min(Math.max(0,ev.clientX-rect.left),Math.max(0,rect.width-190))+'px';tip.style.top=Math.max(93,ev.clientY-rect.top)+'px'});
$('main-chart').addEventListener('pointerleave',()=>{$('chart-tooltip').hidden=true});
let lastWidth=0;new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(Math.abs(width-lastWidth)>2){lastWidth=width;schedule()}}).observe($('chart-container'));
new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting)document.querySelectorAll('.sidebar nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+e.target.id))}},{rootMargin:'-20% 0px -60% 0px'}).observe($('model'));
const observer=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting)document.querySelectorAll('.sidebar nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+e.target.id))}},{rootMargin:'-20% 0px -50% 0px'});['validation','projects','data','method'].forEach(id=>observer.observe($(id)));
render();
})();
