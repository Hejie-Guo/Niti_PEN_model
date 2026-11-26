const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
require('./dist/data.js');const D=globalThis.MODEL_DATA,M=require('./dist/model.js');
let checks=0;
function ok(x,label){assert.ok(x,label);checks++}
function close(a,b,t=1e-9){ok(Number.isFinite(a)&&Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} vs ${b}`)}
ok(M.rows(D,'full').length===204,'complete dataset');ok(M.rows(D,'window').length===172,'window dataset');
ok(M.rows(D,'full',true).length===194,'complete fit records');ok(M.rows(D,'window',true).length===162,'window fit records');
ok(M.rows(D,'full').filter(r=>r.event===0).length===3,'right censoring preserved');
ok(Object.keys(D.models).length===6,'six preserved model choices');
for(const [key,rawCount,fitCount,censored] of [['WIN',35,35,0],['BE',50,50,3],['THK',50,40,0],['LK',69,69,0]]){
 ok(M.rows(D,key).length===rawCount,key+' raw records');ok(M.rows(D,key,true).length===fitCount,key+' fit records');
 ok(M.rows(D,key).every(r=>r.product===key),key+' excludes other projects');
 ok(M.rows(D,key,true).filter(r=>r.event===0).length===censored,key+' censoring');
 ok(D.models[key].predictions.length===fitCount,key+' validation coverage');
 ok(D.models[key].bootstrap.length===1000,key+' parameter samples');
}
for(const key of Object.keys(D.models)){
 const m=D.models[key];
 for(const e of [m.emin,.045,m.emax]){
  close(M.lifetime(m,e,M.CHARACTERISTIC_SURVIVAL),M.scale(m,e),1e-12);
  close(M.strain(m,M.scale(m,e),M.CHARACTERISTIC_SURVIVAL),e,1e-11);
  const ci=M.interval(m,e,M.CHARACTERISTIC_SURVIVAL),samples=m.bootstrap.map(b=>Math.exp(b[0]-b[1]*Math.log(e/.045))).sort((a,b)=>a-b);
  close(ci[0],M.quantile(samples,.025),1e-11);close(ci[1],M.quantile(samples,.975),1e-11);
 }
 for(const e of [m.emin,.045,m.emax])for(const p of [.001,.01,.05,.5,.9,.95,.99,.999]){
  const n=M.lifetime(m,e,p);close(M.survival(m,e,n),p,1e-11);close(M.strain(m,n,p),e,1e-10);
  close(Math.exp(-(M.normalized(m,e,n)**m.k)),p,1e-11);
 }
 for(const r of m.predictions){const f={eta0:Math.exp(r.a),m:r.m,k:r.k};close(M.lifetime(f,r.strain,.5),r.pred50);close(M.lifetime(f,r.strain,.9),r.pred90)}
 const ci=M.interval(m,.045,.9);ok(ci[0]<M.lifetime(m,.045,.9)&&ci[1]>M.lifetime(m,.045,.9),'parameter interval encloses fit');
 ok(M.lifetime(m,m.emin,.5)>M.lifetime(m,m.emax,.5),'life decreases with strain');
 ok(M.lifetime(m,.045,.99)<M.lifetime(m,.045,.9),'survival quantile order');
 const km=M.km(M.rows(D,key,true),m);ok(km.every((p,i)=>p[1]>=0&&p[1]<=1&&(i===0||p[1]<=km[i-1][1])),'KM residual survival');
}
for(const e of [.0388,.045,.056])for(const p of [.001,.01,.05,.5,.9,.95,.99,.999]){
 const t=D.truncated,n=M.truncated(t,e,p),et=M.scale(t,e),h=(n/et)**t.k,hl=(2000/et)**t.k,hu=(8000/et)**t.k;
 ok(n>=2000&&n<=8000,'conditional prediction within window');
 close((Math.exp(-(h-hl))-Math.exp(-(hu-hl)))/(-Math.expm1(-(hu-hl))),p,1e-10);
}
for(const p of [0,1,-1,NaN,Infinity])ok(Number.isNaN(M.lifetime(D.models.window,.045,p)),'P boundary');
for(const e of [0,-1,NaN])ok(Number.isNaN(M.lifetime(D.models.window,e,.9)),'strain boundary');
close(M.lifetime(D.models.window,.045,.9),2994.4,1e-4);
const csv=M.csv([['a,"b',2]],['id','N']);ok(csv.includes('"a,""b"'),'CSV escaping');
const html=fs.readFileSync(path.join(__dirname,'dist/index.html'),'utf8');
for(const relative of [...html.matchAll(/(?:href|src)="([^"#]+)"/g)].map(m=>m[1]).filter(s=>!s.includes(':'))){ok(fs.existsSync(path.join(__dirname,'dist',relative)),'asset '+relative)}
for(const asset of ['project-fatigue-models.xlsx','project-analysis-report.html'])ok(fs.existsSync(path.join(__dirname,'dist/assets',asset)),'project download '+asset);
for(const file of ['app.js','model.js','data.js'])new (require('node:vm').Script)(fs.readFileSync(path.join(__dirname,'dist',file),'utf8'),{filename:file});
console.log(`Passed ${checks} checks: all six models, inverse strain, project isolation, censoring, original datasets, confidence intervals, validation predictions, and downloads.`);
