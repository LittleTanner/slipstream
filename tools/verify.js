const S=require('./sim.js'); const {CFG}=S;
const G=JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'golden.json'),'utf8'));
function policy(race){
  const togo = race.course.len - race.you.dist;
  return { rate: togo < 200 ? 4.0 : 0, ease: false, launch: false, stumble: false, tx: race.you.x };
}
const r3=v=>Math.round(v*1000)/1000;
let fails=[], checks=0;
function eq(a,b,path){ checks++; if(JSON.stringify(a)!==JSON.stringify(b)) fails.push(path); }
function near(a,b,tol,path){ checks++; if(Math.abs(a-b)>tol) fails.push(path+' ('+a+' vs '+b+')'); }
for(const c of G.cases){
  const gc={}; for(const n of ['YOU',...S.FIELD.map(f=>f.name)]) gc[n]={time:0,sprintPts:0,komPts:0};
  const race=S.createRace({seed:c.seed,stageIndex:c.stageIndex,playerType:c.playerType,gc,leaders:{},div:c.div});
  const cc=race.course, ec=c.course;
  const tag='case '+c.seed+'/'+c.stageIndex+'/'+c.playerType;
  eq(cc.len, ec.len, tag+' len');
  eq(cc.climbs.map(x=>[Math.round(x.s),Math.round(x.e)]), ec.climbs, tag+' climbs');
  eq(cc.primes.map(p=>[p.kind,Math.round(p.d)]), ec.primes, tag+' primes');
  eq(cc.feeds.map(f=>[Math.round(f.s),Math.round(f.e)]), ec.feeds, tag+' feeds');
  eq(cc.items.map(i=>[i.kind,Math.round(i.d),r3(i.x)]), ec.items, tag+' items');
  eq(cc.winds.map(w=>[Math.round(w.s),w.dir,r3(w.str)]), ec.winds, tag+' winds');
  let g=0; while(!race.you.finished && g++<120*900) S.step(race,CFG.fixedDt,policy(race));
  const order=S.settle(race);
  eq(order.map(x=>x.place), c.result.map(x=>x.place), tag+' places');
  eq(order.map(x=>x.name), c.result.map(x=>x.name), tag+' order');
  order.forEach((x,i)=>{
    near(x.time, c.result[i].time, G.tolerances.time, tag+' time '+x.name);
    eq(x.sprintPts, c.result[i].sprintPts, tag+' pts '+x.name);
    eq(x.komPts, c.result[i].komPts, tag+' kom '+x.name);
  });
  near(race.you.fuel, c.you.fuel, G.tolerances.resource, tag+' fuel');
  near(race.you.fluid, c.you.fluid, G.tolerances.resource, tag+' fluid');
}
for(const sc of G.schedules){
  eq(S.tourLength(sc.seed,sc.div), sc.len, 'schedule len '+sc.seed);
  eq(S.tourSchedule(sc.seed,sc.len), sc.stages, 'schedule '+sc.seed);
}
console.log(fails.length? 'FAIL ('+fails.length+' of '+checks+')' : 'PASS — all '+checks+' checks');
if(fails.length) console.log(fails.slice(0,8).join('\n'));
