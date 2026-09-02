import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut,setPersistence,browserLocalPersistence} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {initializeFirestore,getFirestore,persistentLocalCache,persistentMultipleTabManager,collection,doc,getDoc,getDocs,query,where,orderBy,startAt,endAt,documentId,onSnapshot} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';

const firebaseApp=initializeApp(firebaseConfig);
const auth=getAuth(firebaseApp);
let db;
try{db=initializeFirestore(firebaseApp,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})})}catch{db=getFirestore(firebaseApp)}
setPersistence(auth,browserLocalPersistence).catch(()=>{});

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const state={user:null,teamId:'',team:null,membership:null,members:[],leaderboard:[],teamAppointments:[],days:new Map(),view:'overview',period:'week',appointmentMode:'upcoming',appointmentAgent:'all',unsubs:[],memberUnsubs:[],sources:{members:'loading',leaderboard:'loading',teamAppointments:'loading',days:new Map(),errors:new Map()},lastUpdated:0};
const TYPES=['MAP','LAP','BAP'];
const TYPE_LABEL={MAP:'Market Appraisal',LAP:'Listing Appointment',BAP:'Buyer Appointment',OFI:'Open for Inspection'};

function esc(value=''){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}
function clamp(value,min=0,max=100){return Math.max(min,Math.min(max,Number(value)||0))}
function number(value){return Number.isFinite(Number(value))?Number(value):0}
function dateKey(date=new Date()){const d=new Date(date);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function parseKey(key){const [year,month,day]=String(key||'').split('-').map(Number);return new Date(year,month-1,day)}
function addDays(date,amount){const d=new Date(date);d.setDate(d.getDate()+amount);return d}
function monday(date=new Date()){const d=new Date(date);const day=d.getDay()||7;d.setDate(d.getDate()-day+1);d.setHours(0,0,0,0);return d}
function formatDate(key,{weekday=false}={}){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(key)))return'No date';return new Intl.DateTimeFormat('en-AU',{weekday:weekday?'short':undefined,day:'numeric',month:'short'}).format(parseKey(key))}
function today(){return dateKey()}
function initials(name=''){return String(name).trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()||'').join('')||'A'}
function firstName(name=''){return String(name||'Agent').trim().split(/\s+/)[0]||'Agent'}
function updatedMillis(value){if(typeof value?.toMillis==='function')return value.toMillis();if(number(value?.seconds))return number(value.seconds)*1000;return number(value)}
function pct(value,target){return target>0?Math.round(number(value)/number(target)*100):0}
function sum(list,key){return list.reduce((total,item)=>total+number(typeof key==='function'?key(item):item?.[key]),0)}
function mean(list,key){return list.length?Math.round(sum(list,key)/list.length):0}
function typeLabel(type=''){return TYPE_LABEL[String(type).toUpperCase()]||String(type||'Appointment')}
function appointmentType(a={}){const raw=String(a.type||a.appointmentType||a.types?.[0]||'MAP').toUpperCase();return TYPES.includes(raw)||raw==='OFI'?raw:'MAP'}
function appointmentScheduledDate(a={},sourceDate=''){return a.scheduledDate||a.date||sourceDate||a.createdDate||''}
function appointmentTimestamp(a={},sourceDate=''){const key=appointmentScheduledDate(a,sourceDate);if(!key)return 0;const [hours,minutes]=String(a.time||'12:00').split(':').map(Number),d=parseKey(key);d.setHours(hours||0,minutes||0,0,0);return d.getTime()}
function appointmentOutcome(a={}){return String(a.outcome||'').trim()}
function isOutcomeClosed(a={}){return Boolean(appointmentOutcome(a)||a.status==='completed'||a.followedUpAt)}
function isAppointmentAttention(a={},sourceDate=''){const ts=appointmentTimestamp(a,sourceDate);return ts>0&&ts<Date.now()&&!isOutcomeClosed(a)&&appointmentType(a)!=='OFI'}
function memberName(uid=''){const live=state.leaderboard.find(item=>item.uid===uid),member=state.members.find(item=>item.uid===uid);return String(live?.name||member?.name||member?.email?.split('@')[0]||'Team member')}

function showOnly(id){['boot','authView','accessView','app'].forEach(name=>$('#'+name)?.classList.toggle('hidden',name!==id))}
function setLive(label,status=''){$('#liveState').className=`live-state ${status}`;$('#liveState').innerHTML=`<i></i> ${esc(label)}`}
function setNotice(message=''){const node=$('#dataNotice');node.textContent=message;node.classList.toggle('hidden',!message)}
function friendlyAuthError(error){const code=String(error?.code||'');if(code.includes('invalid-credential'))return'Email or password is incorrect.';if(code.includes('too-many-requests'))return'Too many attempts. Please wait before trying again.';if(code.includes('network'))return'Check your connection and try again.';return'Could not sign in. Please try again.'}
function stopSubscriptions(){state.unsubs.splice(0).forEach(unsub=>{try{unsub()}catch{}});state.memberUnsubs.splice(0).forEach(unsub=>{try{unsub()}catch{}});state.members=[];state.leaderboard=[];state.teamAppointments=[];state.days.clear();state.sources={members:'loading',leaderboard:'loading',teamAppointments:'loading',days:new Map(),errors:new Map()};state.lastUpdated=0;boundSignature=''}

function reportingReady(){return state.sources.members!=='loading'&&state.sources.leaderboard!=='loading'&&state.members.length>0}
function sourceStatus(key,status,error=null){
  if(key.startsWith('days:'))state.sources.days.set(key.slice(5),status);else state.sources[key]=status;
  if(error)state.sources.errors.set(key,error);else state.sources.errors.delete(key);
  if(status==='live')state.lastUpdated=Date.now();
  updateDataHealth();
}
function updateDataHealth(){
  const health=$('#dataHealth'),updated=$('#lastUpdated');if(!health||!updated)return;
  const expected=state.members.map(member=>state.sources.days.get(member.uid)||'loading'),statuses=[state.sources.members,state.sources.leaderboard,state.sources.teamAppointments,...expected],errors=state.sources.errors.size,cached=statuses.some(status=>status==='cached'),loading=statuses.some(status=>status==='loading'),readyDays=expected.filter(status=>status==='live'||status==='cached').length,total=state.members.length;
  if(errors){health.textContent='Access needs attention';health.className='error';updated.textContent=`${errors} reporting source${errors===1?'':'s'} unavailable`;setLive('Access issue','error');setNotice('Some reporting data could not be loaded. Check the Firebase rules and connection before relying on these figures.');return}
  if(loading){health.textContent=cached?'Cached data · syncing':'Checking access';health.className='warning';updated.textContent=total?`${readyDays} of ${total} agents loaded`:'Waiting for current data';setLive(cached?'Cached':'Connecting',cached?'':'');setNotice(cached?'MNGR is showing verified cached data while the current Firebase connection completes.':'');return}
  health.textContent='Permissions verified';health.className='live';updated.textContent=state.lastUpdated?`Updated ${new Date(state.lastUpdated).toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'})}`:'Live';setLive('Live','live');setNotice('');
}

async function resolveOwnedTeam(user){
  const profileSnap=await getDoc(doc(db,'users',user.uid));
  const profile=profileSnap.exists()?profileSnap.data():{};
  let teamId=String(profile.teamId||'');
  if(!teamId){
    const owned=await getDocs(query(collection(db,'teams'),where('ownerUid','==',user.uid)));
    teamId=owned.docs[0]?.id||'';
  }
  if(!teamId)return null;
  const [teamSnap,memberSnap]=await Promise.all([getDoc(doc(db,'teams',teamId)),getDoc(doc(db,'teams',teamId,'members',user.uid))]);
  if(!teamSnap.exists()||!memberSnap.exists())return null;
  const team=teamSnap.data(),membership=memberSnap.data();
  if(team.ownerUid!==user.uid&&membership.role!=='owner')return null;
  return{teamId,team:{id:teamId,...team},membership:{uid:user.uid,...membership}};
}

async function startManager(user){
  stopSubscriptions();state.user=user;setLive('Confirming access');
  try{
    const access=await resolveOwnedTeam(user);
    if(!access){$('#accessMessage').textContent='This account is not the verified owner of an AGNT team.';showOnly('accessView');return}
    state.teamId=access.teamId;state.team=access.team;state.membership=access.membership;showOnly('app');
    $('#teamName').textContent=String(state.team.name||'AGNT TEAM').toUpperCase();
    subscribeCore();
  }catch(error){console.error(error);$('#accessMessage').textContent=String(error?.code||'').includes('permission-denied')?'Deploy the supplied MNGR Firestore rules before signing in.':'MNGR could not confirm manager access. Check the connection and try again.';showOnly('accessView')}
}

function subscribeCore(){
  setLive('Connecting');
  const teamId=state.teamId;
  state.unsubs.push(onSnapshot(collection(db,'teams',teamId,'members'),{includeMetadataChanges:true},snapshot=>{
    state.members=snapshot.docs.map(item=>({uid:item.id,...item.data()})).sort((a,b)=>(a.role==='owner'?-1:b.role==='owner'?1:0)||memberName(a.uid).localeCompare(memberName(b.uid)));
    sourceStatus('members',snapshot.metadata.fromCache?'cached':'live');bindMemberData();render();
  },error=>handleDataError(error,'members')));
  state.unsubs.push(onSnapshot(collection(db,'teams',teamId,'leaderboard'),{includeMetadataChanges:true},snapshot=>{
    state.leaderboard=snapshot.docs.map(item=>({uid:item.id,...item.data()}));sourceStatus('leaderboard',snapshot.metadata.fromCache?'cached':'live');render();
  },error=>handleDataError(error,'leaderboard')));
  state.unsubs.push(onSnapshot(collection(db,'teams',teamId,'appointments'),{includeMetadataChanges:true},snapshot=>{
    state.teamAppointments=snapshot.docs.map(item=>({teamAppointmentId:item.id,...item.data(),isTeamAssigned:true}));sourceStatus('teamAppointments',snapshot.metadata.fromCache?'cached':'live');render();
  },error=>handleDataError(error,'teamAppointments')));
}

let boundSignature='';
function bindMemberData(){
  const signature=state.members.map(member=>member.uid).sort().join('|');if(signature===boundSignature)return;boundSignature=signature;
  state.memberUnsubs.splice(0).forEach(unsub=>{try{unsub()}catch{}});
  const activeIds=new Set(state.members.map(member=>member.uid));[...state.days.keys()].forEach(uid=>{if(!activeIds.has(uid))state.days.delete(uid)});state.sources.days=new Map(state.members.map(member=>[member.uid,'loading']));[...state.sources.errors.keys()].filter(key=>key.startsWith('days:')).forEach(key=>state.sources.errors.delete(key));
  const from=dateKey(addDays(new Date(),-42)),to=dateKey(addDays(new Date(),120));
  state.members.forEach(member=>{
    const uid=member.uid;
    const daysQuery=query(collection(db,'users',uid,'days'),orderBy(documentId()),startAt(from),endAt(to));
    state.memberUnsubs.push(onSnapshot(daysQuery,{includeMetadataChanges:true},snapshot=>{
      state.days.set(uid,new Map(snapshot.docs.map(item=>[item.id,item.data()])));sourceStatus(`days:${uid}`,snapshot.metadata.fromCache?'cached':'live');render();
    },error=>handleDataError(error,`days:${uid}`)));
  });
  updateDataHealth();
}
function handleDataError(error,source='unknown'){console.error(error);sourceStatus(source,'error',error);if(String(error?.code||'').includes('permission-denied'))setNotice('MNGR could not verify read-only reporting access. Publish the supplied audited Firebase rules before deployment.');}

function leaderboardFor(uid){return state.leaderboard.find(item=>item.uid===uid)||{uid,name:memberName(uid),targets:{calls:50,connects:25,data:10,knock:60},dailyHistory:{},weekHistory:{},appointments:{}}}
function periodKeys(period=state.period){const now=new Date(),start=period==='today'?now:period==='week'?monday(now):addDays(now,-27),end=now;const keys=[];for(let d=new Date(start);d<=end;d=addDays(d,1))keys.push(dateKey(d));return keys}
function historyRecords(entry,period=state.period){const keys=new Set(periodKeys(period));const records=[];Object.entries(entry.dailyHistory||{}).forEach(([key,value])=>{if(keys.has(key))records.push({date:key,...value})});if(period==='today'&&entry.date===today()&&!records.some(item=>item.date===today()))records.push({date:today(),calls:entry.calls,connects:entry.connects,data:entry.data,knockMinutes:entry.knockMinutes,score:entry.score,targets:entry.targets,appointments:entry.appointments,appointmentDetails:entry.appointmentDetails});return records.sort((a,b)=>a.date.localeCompare(b.date))}
function aggregateEntry(entry,period=state.period){const records=historyRecords(entry,period),appointments=records.reduce((total,item)=>total+sum(TYPES,type=>item.appointments?.[type]),0);return{records,calls:sum(records,'calls'),connects:sum(records,'connects'),data:sum(records,'data'),knock:sum(records,'knockMinutes'),score:mean(records,'score'),appointments,scheduledDays:records.length}}
function teamAggregate(period=state.period){const rows=state.members.map(member=>({member,entry:leaderboardFor(member.uid),aggregate:aggregateEntry(leaderboardFor(member.uid),period)}));return{rows,calls:sum(rows,row=>row.aggregate.calls),connects:sum(rows,row=>row.aggregate.connects),data:sum(rows,row=>row.aggregate.data),knock:sum(rows,row=>row.aggregate.knock),score:mean(rows.filter(row=>row.aggregate.records.length),row=>row.aggregate.score),appointments:sum(rows,row=>row.aggregate.appointments),scheduledDays:sum(rows,row=>row.aggregate.scheduledDays)}}

function allAppointments(){
  const map=new Map();
  // Add shared assignments first. A matching personal record replaces it below
  // because the personal record carries the authoritative outcome lifecycle.
  state.teamAppointments.forEach(a=>{
    const agentUid=String(a.assignedToUid||a.setterUid||''),id=String(a.appointmentId||a.teamAppointmentId||''),scheduledDate=appointmentScheduledDate(a,a.createdDate),fallback=[scheduledDate,a.time,a.address,a.contactName,appointmentType(a)].map(value=>String(value||'').trim().toLowerCase()).join('|'),key=id?`id:${id}`:`fallback:${fallback}`;
    map.set(key,{...a,id:id||fallback,sourceDate:a.createdDate||scheduledDate,agentUid,agentName:a.assignedToName||memberName(agentUid),scheduledDate,isTeamAssigned:true});
  });
  state.members.forEach(member=>{
    const uid=member.uid,days=state.days.get(uid)||new Map();
    days.forEach((day,sourceDate)=>(Array.isArray(day.appointments)?day.appointments:[]).forEach(a=>{
      if(appointmentType(a)==='OFI')return;const id=String(a.id||''),scheduledDate=appointmentScheduledDate(a,sourceDate),fallback=[scheduledDate,a.time,a.address,a.contactName,appointmentType(a)].map(value=>String(value||'').trim().toLowerCase()).join('|'),key=id?`id:${id}`:`fallback:${fallback}`,agentUid=String(a.assignedToUid||uid),existing=map.get(key)||{};
      map.set(key,{...existing,...a,id:id||fallback,sourceDate,agentUid,agentName:a.assignedToName||memberName(agentUid),setterUid:String(a.setterUid||uid),scheduledDate,isTeamAssigned:Boolean(a.assignedToUid&&a.assignedToUid!==uid)||Boolean(existing.isTeamAssigned)});
    }));
  });
  return[...map.values()].sort((a,b)=>appointmentTimestamp(a,a.sourceDate)-appointmentTimestamp(b,b.sourceDate));
}
function appointmentBookedDate(a={}){return a.createdDate||a.logDate||a.sourceDate||''}
function appointmentsBookedForPeriod(){const keys=new Set(periodKeys());return allAppointments().filter(a=>keys.has(appointmentBookedDate(a)))}
function appointmentsScheduledForPeriod(){const keys=new Set(periodKeys());return allAppointments().filter(a=>keys.has(a.scheduledDate||appointmentScheduledDate(a,a.sourceDate)))}
function upcomingAppointments(days=120){const now=Date.now()-60*60*1000,end=addDays(new Date(),days).getTime();return allAppointments().filter(a=>{const ts=appointmentTimestamp(a,a.sourceDate);return ts>=now&&ts<=end})}
function recentCompletedAppointments(days=28){const start=addDays(new Date(),-days).getTime();return allAppointments().filter(a=>{const ts=appointmentTimestamp(a,a.sourceDate);return ts>=start&&ts<Date.now()&&isOutcomeClosed(a)})}
function attentionAppointments(){return allAppointments().filter(a=>isAppointmentAttention(a,a.sourceDate))}

function metricCard(label,value,meta='',tone=''){return`<article class="metric-card ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(meta)}</small></article>`}
function renderMetrics(){
  if(!reportingReady()){const waiting=metricCard('Waiting','—','current data');$('#metricGrid').innerHTML=waiting.repeat(6);return}
  const data=teamAggregate();const connectRate=data.calls?Math.round(data.connects/data.calls*100):0,periodLabel=state.period==='today'?'today':state.period==='week'?'this week':'last 4 weeks';
  $('#metricGrid').innerHTML=[metricCard('Calls',data.calls,periodLabel),metricCard('Connects',data.connects,`${connectRate}% connect rate`),metricCard('Data',data.data,periodLabel),metricCard('Knocking',`${data.knock}m`,periodLabel),metricCard('Appointments',data.appointments,'booked in period'),metricCard('Needs outcome',attentionAppointments().length,'past appointments',attentionAppointments().length?'attention':'good')].join('');
}
function renderBrief(){
  if(!reportingReady()){$('#teamScore').textContent='—';$('#briefTitle').textContent='MNGR is confirming current team data.';$('#briefCopy').textContent='Figures will appear once membership, leaderboard and reporting permissions are verified.';return}
  const data=teamAggregate('today'),active=data.rows.filter(row=>row.entry.date===today()&&row.entry.activeToday!==false),atRisk=active.filter(row=>number(row.entry.score)<50),attention=attentionAppointments().length,upcoming=upcomingAppointments(7).length;
  $('#teamScore').textContent=`${data.score}%`;
  if(!active.length){$('#briefTitle').textContent='The team has no scheduled activity today.';$('#briefCopy').textContent=`There are ${upcoming} appointment${upcoming===1?'':'s'} in the next seven days. Use the space to prepare the next working block.`;return}
  if(attention){$('#briefTitle').textContent=`${attention} appointment outcome${attention===1?' needs':'s need'} to be closed.`;$('#briefCopy').textContent=`Activity is visible. The management priority is converting completed appointments into a recorded next step.`;return}
  if(atRisk.length){$('#briefTitle').textContent=`${atRisk.length} agent${atRisk.length===1?' is':'s are'} currently behind today’s pace.`;$('#briefCopy').textContent=`Based on what’s been logged, focus the next coaching conversation on the clearest activity gap.`;return}
  $('#briefTitle').textContent='The team is moving with no urgent outcome gaps.';$('#briefCopy').textContent=`Keep the current prospecting momentum protected and prepare the next ${upcoming} appointment${upcoming===1?'':'s'} across the team.`;
}
function agentStatus(entry){const score=number(entry.score);return score>=75?'on-track':score<40?'off-track':'building'}
function renderAgentPulse(){
  const rows=[...state.members].map(member=>{const live=state.leaderboard.find(item=>item.uid===member.uid),entry=live||leaderboardFor(member.uid),current=Boolean(live&&entry.date===today()),score=current?clamp(entry.score):0,status=current?agentStatus(entry):'waiting',meta=!live?'Waiting for current data':entry.activeToday===false?'Not scheduled':current?`${number(entry.calls)} calls · ${number(entry.connects)} connects`:'No current activity published';return`<article class="agent-row ${status}"><div class="agent-name"><strong>${esc(memberName(member.uid))}</strong><small>${esc(meta)}</small></div><div class="progress"><i style="width:${score}%"></i></div><div class="agent-score">${current?`${score}%`:'—'}</div></article>`}).join('');
  $('#agentPulse').innerHTML=rows||'<div class="empty">No team members found.</div>';
}
function appointmentRow(a,{full=false}={}){const key=a.scheduledDate||appointmentScheduledDate(a,a.sourceDate),type=appointmentType(a),outcome=appointmentOutcome(a),attention=isAppointmentAttention(a,a.sourceDate),time=String(a.time||'12:00'),contact=a.contactName||a.name||'Contact not recorded',address=a.address||'Address not recorded',tag=attention?'Outcome due':outcome||type;return`<article class="appointment-row"><div class="appointment-time"><strong>${esc(formatDate(key,{weekday:true}))}</strong>${esc(time)}</div><div class="appointment-copy"><strong>${esc(contact)}</strong><small>${esc(address)}</small></div>${full?`<div class="appointment-agent">${esc(a.agentName||memberName(a.agentUid))}</div><div class="appointment-outcome"><strong>${esc(outcome||'Outcome not recorded')}</strong><small>${esc(a.followUpDate?`Follow-up ${formatDate(a.followUpDate)}`:attention?'Manager attention':'')}</small></div>`:''}<span class="tag ${attention?'attention':type}">${esc(tag)}</span></article>`}
function renderUpcomingPreview(){const list=upcomingAppointments(7).slice(0,5);$('#upcomingPreview').innerHTML=list.map(a=>appointmentRow(a)).join('')||'<div class="empty">No upcoming appointments in the next seven days.</div>'}
function renderAttention(){const attention=attentionAppointments(),todayData=teamAggregate('today'),low=todayData.rows.filter(row=>row.entry.activeToday!==false&&number(row.entry.score)<50),items=[];if(attention.length)items.push({tone:'critical',title:`${attention.length} appointment outcome${attention.length===1?'':'s'} overdue`,copy:'Close the result or set the next follow-up so opportunity is not left open.'});low.slice(0,2).forEach(row=>items.push({tone:'',title:`${firstName(memberName(row.member.uid))} is at ${number(row.entry.score)}% today`,copy:`${number(row.entry.calls)} calls, ${number(row.entry.connects)} connects and ${number(row.entry.data)} data logged.`}));if(!upcomingAppointments(7).length)items.push({tone:'',title:'No appointments in the next seven days',copy:'The next management conversation should focus on converting connects into appointments.'});$('#attentionList').innerHTML=items.map(item=>`<article class="attention-item ${item.tone}"><i></i><div><strong>${esc(item.title)}</strong><small>${esc(item.copy)}</small></div></article>`).join('')||'<div class="empty">No immediate management attention required.</div>'}

function weekBuckets(){const current=monday(),buckets=[];for(let offset=-3;offset<=0;offset++){const start=addDays(current,offset*7),end=addDays(start,6),keys=[];for(let d=new Date(start);d<=end;d=addDays(d,1))keys.push(dateKey(d));let calls=0,appointments=0;state.leaderboard.forEach(entry=>Object.entries(entry.dailyHistory||{}).forEach(([key,record])=>{if(!keys.includes(key))return;calls+=number(record.calls);appointments+=sum(TYPES,type=>record.appointments?.[type])}));buckets.push({label:new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short'}).format(start),calls,appointments})}return buckets}
function trendMarkup(buckets,large=false){const maxCalls=Math.max(1,...buckets.map(item=>item.calls)),maxAppointments=Math.max(1,...buckets.map(item=>item.appointments)),height=large?235:135;return`${buckets.map(item=>`<div class="trend-column" title="${item.calls} calls · ${item.appointments} appointments"><div class="trend-bars"><i style="height:${Math.max(2,item.calls/maxCalls*height)}px"></i><i style="height:${Math.max(2,item.appointments/maxAppointments*height)}px"></i></div><small>${esc(item.label)}</small></div>`).join('')}<div class="trend-legend" style="position:absolute;left:0;bottom:-25px"><span><i></i>Calls</span><span><i></i>Appointments</span></div>`}
function renderOverviewTrend(){const node=$('#overviewTrend');node.style.position='relative';node.innerHTML=trendMarkup(weekBuckets())}

function directionFor(entry){const records=Object.entries(entry.dailyHistory||{}).sort(([a],[b])=>a.localeCompare(b)).slice(-20).map(([,value])=>value),half=Math.ceil(records.length/2),prior=mean(records.slice(0,half),'score'),recent=mean(records.slice(half),'score'),diff=recent-prior;return diff>=5?{label:`↑ ${diff}%`,className:'direction-up'}:diff<=-5?{label:`↓ ${Math.abs(diff)}%`,className:'direction-down'}:{label:'→ Steady',className:''}}
function renderTeamCards(){
  const period=state.period;$('#teamCards').innerHTML=state.members.map(member=>{const live=state.leaderboard.find(item=>item.uid===member.uid),entry=live||leaderboardFor(member.uid),data=aggregateEntry(entry,period),direction=live?directionFor(entry):{label:'Waiting',className:''},connectRate=data.calls?Math.round(data.connects/data.calls*100):0,meta=!live?'Waiting for current data':member.role==='owner'?'Team owner':data.scheduledDays?`${data.scheduledDays} logged workday${data.scheduledDays===1?'':'s'}`:'No activity in period',display=live?value=>value:()=> '—';return`<article class="team-card"><div class="team-card-head"><div class="team-person"><span class="avatar">${esc(initials(memberName(member.uid)))}</span><div><strong>${esc(memberName(member.uid))}</strong><small>${esc(meta)}</small></div></div><span class="score-ring" style="--score:${live?clamp(data.score)*3.6:0}deg"><b>${live?`${data.score}%`:'—'}</b></span></div><div class="team-metrics"><div><strong>${display(data.calls)}</strong><span>Calls</span></div><div><strong>${display(data.connects)}</strong><span>Connects</span></div><div><strong>${display(data.data)}</strong><span>Data</span></div><div><strong>${display(data.appointments)}</strong><span>Appts</span></div></div><div class="team-card-foot"><span>${live?`${connectRate}% connect rate · ${data.knock}m knocking`:'Current data not yet available'}</span><strong class="${direction.className}">${esc(direction.label)}</strong></div></article>`}).join('')||'<div class="empty">No verified team members found.</div>';
}

function renderAppointmentStats(){const booked=appointmentsBookedForPeriod(),scheduled=appointmentsScheduledForPeriod(),upcoming=upcomingAppointments(),completed=recentCompletedAppointments(),attention=attentionAppointments();$('#appointmentStats').innerHTML=[metricCard('Booked',booked.length,'created in period'),metricCard('Scheduled',scheduled.length,'occurring in period'),metricCard('Upcoming',upcoming.length,'next 120 days'),metricCard('Outcomes',completed.length,'recorded in 28 days'),metricCard('Outcome overdue',attention.length,'requires attention',attention.length?'critical':'good')].join('')}
function renderAppointmentFilters(){const select=$('#appointmentAgentFilter'),value=state.appointmentAgent;select.innerHTML='<option value="all">All agents</option>'+state.members.map(member=>`<option value="${esc(member.uid)}">${esc(memberName(member.uid))}</option>`).join('');select.value=state.members.some(member=>member.uid===value)?value:'all';state.appointmentAgent=select.value}
function renderAppointmentList(){let list=state.appointmentMode==='upcoming'?upcomingAppointments():state.appointmentMode==='outcomes'?recentCompletedAppointments():attentionAppointments();if(state.appointmentAgent!=='all')list=list.filter(a=>a.agentUid===state.appointmentAgent);if(state.appointmentMode!=='upcoming')list=[...list].sort((a,b)=>appointmentTimestamp(b,b.sourceDate)-appointmentTimestamp(a,a.sourceDate));$('#appointmentList').innerHTML=list.map(a=>appointmentRow(a,{full:true})).join('')||`<div class="empty">No ${state.appointmentMode==='upcoming'?'upcoming appointments':state.appointmentMode==='outcomes'?'recorded outcomes':'overdue outcomes'} found.</div>`}

function renderTrends(){
  const four=teamAggregate('four'),connectRate=four.calls?Math.round(four.connects/four.calls*100):0,appointmentRate=four.connects?Math.round(four.appointments/four.connects*100):0,dataRate=four.connects?Math.round(four.data/four.connects*100):0;
  $('#trendSummary').innerHTML=[metricCard('Calls',four.calls,'last 4 weeks'),metricCard('Connect rate',`${connectRate}%`,`${four.connects} connects`),metricCard('Appointment rate',`${appointmentRate}%`,'appointments per connect'),metricCard('Data rate',`${dataRate}%`,'data per connect'),metricCard('Avg completion',`${four.score}%`,'logged scheduled days'),metricCard('Knocking',`${four.knock}m`,'last 4 weeks')].join('');
  const chart=$('#mainTrendChart');chart.style.position='relative';chart.innerHTML=trendMarkup(weekBuckets(),true);
  $('#conversionList').innerHTML=[['Connect rate',connectRate,55],['Appointment rate',appointmentRate,20],['Data capture',dataRate,40]].map(([label,value,target])=>`<article class="conversion-item"><div><span>${esc(label)}</span><strong>${value}%</strong></div><div class="progress"><i style="width:${clamp(value/target*100)}%"></i></div></article>`).join('');
  $('#trendTable').innerHTML=state.members.map(member=>{const entry=leaderboardFor(member.uid),data=aggregateEntry(entry,'four'),direction=directionFor(entry),connect=data.calls?Math.round(data.connects/data.calls*100):0;return`<tr><td>${esc(memberName(member.uid))}</td><td>${data.scheduledDays}</td><td>${data.score}%</td><td>${data.calls}</td><td>${connect}%</td><td>${data.appointments}</td><td class="${direction.className}">${esc(direction.label)}</td></tr>`}).join('');
}

function render(){if($('#app').classList.contains('hidden'))return;renderBrief();renderMetrics();renderAgentPulse();renderUpcomingPreview();renderAttention();renderOverviewTrend();renderTeamCards();renderAppointmentStats();renderAppointmentFilters();renderAppointmentList();renderTrends()}
function switchView(view){state.view=view;$$('.nav-item').forEach(button=>button.classList.toggle('active',button.dataset.view===view));$$('.view').forEach(node=>node.classList.toggle('active',node.id===`${view}View`));const titles={overview:'Management overview',team:'Team performance',appointments:'Appointment intelligence',trends:'Prospecting trends'};$('#pageTitle').textContent=titles[view]||'MNGR';window.scrollTo({top:0,behavior:'smooth'})}

$('#loginForm').addEventListener('submit',async event=>{event.preventDefault();const button=$('#loginButton');button.disabled=true;button.textContent='Signing in…';$('#authMessage').textContent='';try{await signInWithEmailAndPassword(auth,$('#email').value.trim(),$('#password').value)}catch(error){$('#authMessage').textContent=friendlyAuthError(error)}finally{button.disabled=false;button.textContent='Sign in'}});
$('#signOut').addEventListener('click',()=>signOut(auth));$('#accessSignOut').addEventListener('click',()=>signOut(auth));
$$('.nav-item').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.view)));
$$('[data-go]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.go)));
$('#periodSelect').addEventListener('change',event=>{state.period=event.target.value;render()});
$('#appointmentAgentFilter').addEventListener('change',event=>{state.appointmentAgent=event.target.value;renderAppointmentList()});
$$('[data-appointment-mode]').forEach(button=>button.addEventListener('click',()=>{state.appointmentMode=button.dataset.appointmentMode;$$('[data-appointment-mode]').forEach(item=>item.classList.toggle('active',item===button));renderAppointmentList()}));
$('#refreshData').addEventListener('click',()=>{const button=$('#refreshData');button.classList.add('loading');button.disabled=true;setTimeout(()=>window.location.reload(),180)});

onAuthStateChanged(auth,user=>{if(user)startManager(user);else{stopSubscriptions();state.user=null;state.teamId='';state.team=null;boundSignature='';showOnly('authView')}});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.error));
