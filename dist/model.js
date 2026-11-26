(function(root){
'use strict';
const EPS0=.045;
const CHARACTERISTIC_SURVIVAL=Math.exp(-1);
function validP(p){return Number.isFinite(p)&&p>0&&p<1}
function scale(m,e){return Number.isFinite(e)&&e>0?m.eta0*Math.pow(e/EPS0,-m.m):NaN}
function lifetime(m,e,p){return validP(p)?scale(m,e)*Math.pow(-Math.log(p),1/m.k):NaN}
function strain(m,n,p){return Number.isFinite(n)&&n>0&&validP(p)?EPS0*Math.pow(m.eta0*Math.pow(-Math.log(p),1/m.k)/n,1/m.m):NaN}
function survival(m,e,n){return n>=0?Math.exp(-Math.pow(n/scale(m,e),m.k)):NaN}
function normalized(m,e,n){return n/scale(m,e)}
function quantile(sorted,q){const h=(sorted.length-1)*q,i=Math.floor(h);return sorted[i]+(sorted[Math.min(i+1,sorted.length-1)]-sorted[i])*(h-i)}
function interval(m,e,p){
 if(!validP(p)||!Number.isFinite(e)||e<=0)return [NaN,NaN];
 const x=Math.log(e/EPS0),lp=Math.log(-Math.log(p));
 const values=m.bootstrap.map(b=>Math.exp(b[0]-b[1]*x+lp/Math.exp(b[2]))).sort((a,b)=>a-b);
 return [quantile(values,.025),quantile(values,.975)];
}
function truncated(m,e,p){
 if(!validP(p)||!Number.isFinite(e)||e<=0)return NaN;
 const eta=scale(m,e),lo=Math.pow(2000/eta,m.k),hi=Math.pow(8000/eta,m.k);
 const a=Math.log(p),b=Math.log1p(-p)-(hi-lo),max=Math.max(a,b);
 const logmix=max+Math.log(Math.exp(a-max)+Math.exp(b-max));
 return eta*Math.pow(lo-logmix,1/m.k);
}
function rows(data,key,onlyFit=false){const project=data.models[key]?.project;return data.raw.filter(r=>(project?r.product===project:(key==='full'||r.in_life_window))&&(!onlyFit||r.included))}
function csv(rows,headers){const escape=v=>'"'+String(v??'').replaceAll('"','""')+'"';return '\ufeff'+[headers,...rows].map(r=>r.map(escape).join(',')).join('\r\n')}
function km(records,m){
 const list=records.map(r=>({z:normalized(m,r.strain,r.life),event:r.event})).sort((a,b)=>a.z-b.z);
 const points=[[0,1]];let s=1,i=0;
 while(i<list.length){const z=list[i].z,risk=list.length-i;let j=i,d=0;while(j<list.length&&list[j].z===z){d+=list[j].event;j++}points.push([z,s]);s*=1-d/risk;points.push([z,s]);i=j}
 return points;
}
const api={EPS0,CHARACTERISTIC_SURVIVAL,validP,scale,lifetime,strain,survival,normalized,interval,truncated,rows,csv,km,quantile};
root.FatigueModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
