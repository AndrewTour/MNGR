import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,updateProfile,signOut,setPersistence,browserLocalPersistence} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {initializeFirestore,getFirestore,persistentLocalCache,persistentMultipleTabManager,collection,collectionGroup,doc,getDoc,getDocs,query,where,orderBy,startAt,endAt,documentId,onSnapshot,setDoc,updateDoc,writeBatch,serverTimestamp,Timestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js?v=2.6.0';

const firebaseApp=initializeApp(firebaseConfig);
const auth=getAuth(firebaseApp);
let db;
try{db=initializeFirestore(firebaseApp,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})})}catch{db=getFirestore(firebaseApp)}
setPersistence(auth,browserLocalPersistence).catch(()=>{});

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const state={user:null,profile:null,agentProfileExists:false,managerProfile:null,ownedResources:[],resources:[],resourceData:new Map(),scopeKey:'all',teamId:'',team:null,membership:null,members:[],leaderboard:[],teamAppointments:[],days:new Map(),view:'overview',period:'week',appointmentMode:'upcoming',appointmentAgent:'all',pendingRequest:null,pendingRequests:[],givenApprovals:[],unsubs:[],memberUnsubs:[],accessUnsubs:[],sources:{resources:new Map(),days:new Map(),errors:new Map()},lastUpdated:0};
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
function periodName(){return state.period==='today'?'Today':state.period==='week'?'This week':'Last 4 weeks'}
function greeting(){const hour=new Date().getHours();return hour<12?'Good morning':hour<18?'Good afternoon':'Good evening'}
function formattedToday(){return new Intl.DateTimeFormat('en-AU',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}
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
function scopeType(){return state.scopeKey==='all'?'all':state.scopeKey.split(':')[0]}
function scopeId(){return state.scopeKey==='all'?'':state.scopeKey.slice(state.scopeKey.indexOf(':')+1)}
function scopeIsTeam(){return scopeType()!=='agent'}
function scopedMembers(){return state.members}
function scopeName(){if(scopeType()==='all')return'All Managed';if(scopeType()==='team')return state.resources.find(resource=>resource.key===state.scopeKey)?.name||'Whole Team';return memberName(scopeId())}

function showOnly(id){['boot','authView','accessView','app'].forEach(name=>$('#'+name)?.classList.toggle('hidden',name!==id))}
function setLive(label,status=''){$('#liveState').className=`live-state app-live-state ${status}`;$('#liveState').innerHTML=`<i></i> ${esc(label)}`}
function setNotice(message=''){const node=$('#dataNotice');node.textContent=message;node.classList.toggle('hidden',!message)}
function friendlyAuthError(error){const code=String(error?.code||'');if(code.includes('invalid-credential'))return'Email or password is incorrect.';if(code.includes('email-already-in-use'))return'An account already exists for this email. Sign in instead.';if(code.includes('weak-password'))return'Use a password with at least eight characters.';if(code.includes('too-many-requests'))return'Too many attempts. Please wait before trying again.';if(code.includes('network'))return'Check your connection and try again.';return'Could not complete the account request. Please try again.'}
function stopSubscriptions(){[state.unsubs,state.memberUnsubs,state.accessUnsubs].forEach(list=>list.splice(0).forEach(unsub=>{try{unsub()}catch{}}));state.profile=null;state.agentProfileExists=false;state.managerProfile=null;state.ownedResources=[];state.resources=[];state.resourceData.clear();state.members=[];state.leaderboard=[];state.teamAppointments=[];state.days.clear();state.scopeKey='all';state.appointmentAgent='all';state.pendingRequest=null;state.pendingRequests=[];state.givenApprovals=[];state.sources={resources:new Map(),days:new Map(),errors:new Map()};state.lastUpdated=0;boundSignature='';resourceSignature=''}

function reportingReady(){const keys=scopeType()==='all'?state.resources.map(resource=>resource.key):scopeType()==='team'?[state.scopeKey]:[...state.resourceData.values()].filter(data=>data.members.some(member=>member.uid===scopeId())).map(data=>data.resource.key),statuses=[...state.sources.resources.entries()].filter(([key])=>keys.some(resourceKey=>key.startsWith(`${resourceKey}:`))).map(([,status])=>status);return state.members.length>0&&!statuses.some(status=>status==='loading')}
function sourceStatus(key,status,error=null){
  if(key.startsWith('days:'))state.sources.days.set(key.slice(5),status);else state.sources.resources.set(key,status);
  if(error)state.sources.errors.set(key,error);else state.sources.errors.delete(key);
  if(status==='live')state.lastUpdated=Date.now();
  updateDataHealth();
}
function isReportingSourceKey(key=''){
  if(key.startsWith('days:'))return true;
  return[...state.resourceData.keys()].some(resourceKey=>key.startsWith(`${resourceKey}:`));
}
function reportingErrorCount(){return[...state.sources.errors.keys()].filter(isReportingSourceKey).length}
function updateDataHealth(){
  const health=$('#dataHealth'),updated=$('#lastUpdated');if(!health||!updated)return;
  const allMembers=allResourceMembers(),expected=allMembers.map(member=>state.sources.days.get(member.uid)||'loading'),statuses=[...state.sources.resources.values(),...expected],errors=reportingErrorCount(),cached=statuses.some(status=>status==='cached'),loading=statuses.some(status=>status==='loading'),readyDays=expected.filter(status=>status==='live'||status==='cached').length,total=allMembers.length;
  if(errors){health.textContent='Partial data';health.className='error';updated.textContent=`${errors} reporting source${errors===1?'':'s'} unavailable`;setLive('Partial data','error');setNotice(`${errors} reporting source${errors===1?' is':'s are'} unavailable. Available figures remain live.`);return}
  if(loading){health.textContent=cached?'Cached data · syncing':'Checking access';health.className='warning';updated.textContent=total?`${readyDays} of ${total} agents loaded`:'Waiting for current data';setLive(cached?'Cached':'Connecting',cached?'':'');setNotice(cached?'MNGR is showing verified cached data while the current Firebase connection completes.':'');return}
  health.textContent='Permissions verified';health.className='live';updated.textContent=state.lastUpdated?`Updated ${new Date(state.lastUpdated).toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'})}`:'Live';setLive('Live','live');setNotice('');
}

function requestIdFromUrl(){return new URLSearchParams(location.search).get('request')||''}
function managerDisplayName(){return state.profile?.name||state.managerProfile?.name||state.user?.displayName||state.user?.email?.split('@')[0]||'Manager'}
function renderHeader(){const title=$('#pageTitle'),meta=$('#teamName');if(!title||!meta)return;if(state.view==='overview'){title.innerHTML=`${greeting()},<br>${esc(firstName(managerDisplayName()))}`;meta.textContent=formattedToday();return}const titles={team:'Team performance',appointments:'Appointments',trends:'Prospecting trends'};title.textContent=titles[state.view]||'MNGR';meta.textContent=`${scopeName()} · ${periodName()}`}
function resourceFromGrant(grant){return{key:`${grant.resourceType}:${grant.resourceId}`,type:grant.resourceType,id:grant.resourceId,name:grant.resourceName||`${grant.resourceType==='team'?'Team':'Agent'} access`,access:'grant',grantId:grant.id,grantedByUid:grant.grantedByUid}}
function mergeResources(grants=[]){const map=new Map(state.ownedResources.map(resource=>[resource.key,resource]));grants.filter(grant=>grant.status==='active').forEach(grant=>map.set(`${grant.resourceType}:${grant.resourceId}`,resourceFromGrant(grant)));state.resources=[...map.values()].sort((a,b)=>(a.type==='team'?-1:1)-(b.type==='team'?-1:1)||a.name.localeCompare(b.name));if(state.scopeKey!=='all'&&!state.resources.some(resource=>resource.key===state.scopeKey)&&!state.scopeKey.startsWith('agent:'))state.scopeKey='all';subscribeReportingResources();renderAccess()}

async function loadOwnedResources(user){
  const owned=await getDocs(query(collection(db,'teams'),where('ownerUid','==',user.uid)));
  return owned.docs.map(item=>({key:`team:${item.id}`,type:'team',id:item.id,name:item.data().name||'My Team',access:'owner'}));
}

async function startManager(user){
  stopSubscriptions();state.user=user;setLive('Confirming access');
  try{
    const tagged=(source,promise)=>promise.catch(error=>{try{error.mngrSource=source}catch{}throw error});
    const [profileSnap,managerSnap,ownedResources]=await Promise.all([tagged('profile',getDoc(doc(db,'users',user.uid))),tagged('manager-profile',getDoc(doc(db,'managerProfiles',user.uid))),tagged('owned-teams',loadOwnedResources(user))]);
    state.profile=profileSnap.exists()?profileSnap.data():{};state.agentProfileExists=profileSnap.exists();state.managerProfile=managerSnap.exists()?managerSnap.data():null;state.ownedResources=ownedResources;showOnly('app');renderHeader();subscribeAccessContext();
    const requestId=requestIdFromUrl();if(requestId){try{const requestSnap=await getDoc(doc(db,'managementRequests',requestId));state.pendingRequest=requestSnap.exists()?{id:requestSnap.id,...requestSnap.data()}:null}catch(error){console.error(error)}openAccessSheet()}
  }catch(error){console.error(error);const denied=String(error?.code||'').includes('permission-denied');$('#accessMessage').textContent=denied&&error?.mngrSource==='owned-teams'?'MNGR could not read your owned-team list. Publish the query-safe MNGR v2.0.1 rule update, then reopen the app.':denied?'Firebase denied one of MNGR’s startup checks. Confirm the v2.0.1 rules are deployed to the same Firebase project as this app.':'MNGR could not confirm access. Check the connection and try again.';showOnly('accessView')}
}

function subscribeAccessContext(){
  const uid=state.user.uid;setLive('Connecting');
  state.accessUnsubs.push(onSnapshot(collection(db,'managerAccess',uid,'grants'),snapshot=>{const grants=snapshot.docs.map(item=>({id:item.id,...item.data()}));mergeResources(grants)},error=>handleDataError(error,'manager-grants')));
  state.accessUnsubs.push(onSnapshot(query(collection(db,'managementRequests'),where('managerUid','==',uid),where('status','==','pending')),snapshot=>{state.pendingRequests=snapshot.docs.map(item=>({id:item.id,...item.data()}));renderAccess()},error=>handleDataError(error,'pending-requests')));
  state.accessUnsubs.push(onSnapshot(query(collectionGroup(db,'grants'),where('grantedByUid','==',uid),where('status','==','active')),snapshot=>{state.givenApprovals=snapshot.docs.map(item=>({id:item.id,...item.data()}));renderAccess()},error=>handleDataError(error,'given-approvals')));
}

let resourceSignature='';
function subscribeReportingResources(){
  const signature=state.resources.map(resource=>resource.key).sort().join('|');if(signature===resourceSignature)return;resourceSignature=signature;
  state.unsubs.splice(0).forEach(unsub=>{try{unsub()}catch{}});state.resourceData.clear();state.sources.resources.clear();[...state.sources.errors.keys()].filter(key=>!key.startsWith('days:')).forEach(key=>state.sources.errors.delete(key));
  state.resources.forEach(resource=>{
    if(resource.type==='team'){
      const data={resource,members:[],leaderboard:[],appointments:[]};state.resourceData.set(resource.key,data);['members','leaderboard','appointments'].forEach(kind=>sourceStatus(`${resource.key}:${kind}`,'loading'));
      state.unsubs.push(onSnapshot(collection(db,'teams',resource.id,'members'),{includeMetadataChanges:true},snapshot=>{data.members=snapshot.docs.map(item=>({uid:item.id,...item.data(),teamId:resource.id,teamName:resource.name})).sort((a,b)=>(a.role==='owner'?-1:b.role==='owner'?1:0)||String(a.name||a.email||'').localeCompare(String(b.name||b.email||'')));sourceStatus(`${resource.key}:members`,snapshot.metadata.fromCache?'cached':'live');bindMemberData();render()},error=>handleDataError(error,`${resource.key}:members`)));
      state.unsubs.push(onSnapshot(collection(db,'teams',resource.id,'leaderboard'),{includeMetadataChanges:true},snapshot=>{data.leaderboard=snapshot.docs.map(item=>({uid:item.id,...item.data(),teamId:resource.id}));sourceStatus(`${resource.key}:leaderboard`,snapshot.metadata.fromCache?'cached':'live');render()},error=>handleDataError(error,`${resource.key}:leaderboard`)));
      state.unsubs.push(onSnapshot(collection(db,'teams',resource.id,'appointments'),{includeMetadataChanges:true},snapshot=>{data.appointments=snapshot.docs.map(item=>({teamAppointmentId:item.id,...item.data(),teamId:resource.id,isTeamAssigned:true}));sourceStatus(`${resource.key}:appointments`,snapshot.metadata.fromCache?'cached':'live');render()},error=>handleDataError(error,`${resource.key}:appointments`)));
    }else{
      const member={uid:resource.id,name:resource.name,role:'solo',teamName:'Direct agent'},data={resource,members:[member],leaderboard:[],appointments:[]};state.resourceData.set(resource.key,data);sourceStatus(`${resource.key}:leaderboard`,'loading');
      state.unsubs.push(onSnapshot(doc(db,'leaderboard',resource.id),{includeMetadataChanges:true},snapshot=>{data.leaderboard=snapshot.exists()?[{uid:snapshot.id,...snapshot.data()}]:[];sourceStatus(`${resource.key}:leaderboard`,snapshot.metadata.fromCache?'cached':'live');bindMemberData();render()},error=>handleDataError(error,`${resource.key}:leaderboard`)));
    }
  });
  bindMemberData();render();
}

function allResourceMembers(){const map=new Map();state.resourceData.forEach(data=>data.members.forEach(member=>map.set(member.uid,member)));return[...map.values()]}
function applyScopeData(){
  let datasets=[...state.resourceData.values()];
  if(scopeType()==='team')datasets=datasets.filter(data=>data.resource.key===state.scopeKey);
  const agentUid=scopeType()==='agent'?scopeId():'';
  const members=new Map(),leaderboard=new Map(),appointments=[];
  datasets.forEach(data=>{data.members.filter(member=>!agentUid||member.uid===agentUid).forEach(member=>members.set(member.uid,member));data.leaderboard.filter(entry=>!agentUid||entry.uid===agentUid).forEach(entry=>leaderboard.set(entry.uid,entry));appointments.push(...data.appointments)});
  state.members=[...members.values()];state.leaderboard=[...leaderboard.values()];state.teamAppointments=appointments;state.teamId=scopeType()==='team'?scopeId():'';state.team=scopeType()==='team'?state.resources.find(resource=>resource.key===state.scopeKey):null;
}

let boundSignature='';
function bindMemberData(){
  const members=allResourceMembers(),signature=members.map(member=>member.uid).sort().join('|');if(signature===boundSignature)return;boundSignature=signature;
  state.memberUnsubs.splice(0).forEach(unsub=>{try{unsub()}catch{}});const activeIds=new Set(members.map(member=>member.uid));[...state.days.keys()].forEach(uid=>{if(!activeIds.has(uid))state.days.delete(uid)});state.sources.days=new Map(members.map(member=>[member.uid,'loading']));[...state.sources.errors.keys()].filter(key=>key.startsWith('days:')).forEach(key=>state.sources.errors.delete(key));
  const from=dateKey(addDays(new Date(),-42)),to=dateKey(addDays(new Date(),120));members.forEach(member=>{const uid=member.uid,daysQuery=query(collection(db,'users',uid,'days'),orderBy(documentId()),startAt(from),endAt(to));state.memberUnsubs.push(onSnapshot(daysQuery,{includeMetadataChanges:true},snapshot=>{state.days.set(uid,new Map(snapshot.docs.map(item=>[item.id,item.data()])));sourceStatus(`days:${uid}`,snapshot.metadata.fromCache?'cached':'live');render()},error=>handleDataError(error,`days:${uid}`)))});updateDataHealth();
}
function handleDataError(error,source='unknown'){console.error(error);sourceStatus(source,'error',error);if(isReportingSourceKey(source)&&String(error?.code||'').includes('permission-denied'))setNotice('One authorised reporting source is unavailable. Available figures remain live.');}

function leaderboardFor(uid){return state.leaderboard.find(item=>item.uid===uid)||{uid,name:memberName(uid),targets:{calls:50,connects:25,data:10,knock:60},dailyHistory:{},weekHistory:{},appointments:{}}}
function periodKeys(period=state.period){const now=new Date(),start=period==='today'?now:period==='week'?monday(now):addDays(now,-27),end=now;const keys=[];for(let d=new Date(start);d<=end;d=addDays(d,1))keys.push(dateKey(d));return keys}
function periodLabel(period=state.period){return period==='today'?'today':period==='week'?'this week':'the last 4 weeks'}
function periodEyebrow(period=state.period){return period==='today'?'TODAY':period==='week'?'THIS WEEK':'LAST 4 WEEKS'}
function entryWorkDays(entry={}){return Array.isArray(entry.workDays)?[...new Set(entry.workDays.map(Number).filter(day=>day>=0&&day<=6))]:[]}
function entryScheduledOn(entry,key){const workDays=entryWorkDays(entry);if(key===today()&&typeof entry.activeToday==='boolean')return entry.activeToday;if(workDays.length)return workDays.includes(parseKey(key).getDay());return true}
function historyRecords(entry,period=state.period){const keys=new Set(periodKeys(period)),records=[];Object.entries(entry.dailyHistory||{}).forEach(([key,value])=>{if(keys.has(key)&&entryScheduledOn(entry,key))records.push({date:key,...value})});if(keys.has(today())&&entry.date===today()&&entryScheduledOn(entry,today())&&!records.some(item=>item.date===today()))records.push({date:today(),calls:entry.calls,connects:entry.connects,data:entry.data,knockMinutes:entry.knockMinutes,score:entry.score,targets:entry.targets,appointments:entry.appointments,appointmentDetails:entry.appointmentDetails});return records.sort((a,b)=>a.date.localeCompare(b.date))}
function aggregateEntry(entry,period=state.period){const records=historyRecords(entry,period),appointments=records.reduce((total,item)=>total+sum(TYPES,type=>item.appointments?.[type]),0);return{records,calls:sum(records,'calls'),connects:sum(records,'connects'),data:sum(records,'data'),knock:sum(records,'knockMinutes'),score:mean(records,'score'),appointments,scheduledDays:records.length}}
function teamAggregate(period=state.period){const rows=scopedMembers().map(member=>({member,entry:leaderboardFor(member.uid),aggregate:aggregateEntry(leaderboardFor(member.uid),period)}));return{rows,calls:sum(rows,row=>row.aggregate.calls),connects:sum(rows,row=>row.aggregate.connects),data:sum(rows,row=>row.aggregate.data),knock:sum(rows,row=>row.aggregate.knock),score:mean(rows.filter(row=>row.aggregate.records.length),row=>row.aggregate.score),appointments:sum(rows,row=>row.aggregate.appointments),scheduledDays:sum(rows,row=>row.aggregate.scheduledDays)}}
function periodAgentHealth(period=state.period){return scopedMembers().map(member=>{const entry=leaderboardFor(member.uid),aggregate=aggregateEntry(entry,period),hasData=aggregate.records.length>0,sourceState=state.sources.days.get(member.uid)||'loading',expectedDays=periodKeys(period).filter(key=>entryScheduledOn(entry,key)).length,status=hasData?(aggregate.score>=75?'on-track':aggregate.score>=50?'at-risk':'off-track'):(sourceState==='loading'?'syncing':'no-data'),label=status==='on-track'?'On track':status==='at-risk'?'At risk':status==='off-track'?'Off track':status==='syncing'?'Syncing':expectedDays?'No data':'Not scheduled';return{member,entry,aggregate,hasData,sourceState,expectedDays,status,label}}).sort((a,b)=>Number(b.hasData)-Number(a.hasData)||b.aggregate.score-a.aggregate.score||b.aggregate.calls-a.aggregate.calls||memberName(a.member.uid).localeCompare(memberName(b.member.uid)))}

function allAppointments(){
  const map=new Map();
  // Add shared assignments first. A matching personal record replaces it below
  // because the personal record carries the authoritative outcome lifecycle.
  state.teamAppointments.forEach(a=>{
    const agentUid=String(a.assignedToUid||a.setterUid||''),id=String(a.appointmentId||a.teamAppointmentId||''),scheduledDate=appointmentScheduledDate(a,a.createdDate),resourceKey=String(a.teamId||'solo'),fallback=[resourceKey,scheduledDate,a.time,a.address,a.contactName,appointmentType(a)].map(value=>String(value||'').trim().toLowerCase()).join('|'),key=id?`id:${resourceKey}:${id}`:`fallback:${fallback}`;
    map.set(key,{...a,id:id||fallback,sourceDate:a.createdDate||scheduledDate,agentUid,agentName:a.assignedToName||memberName(agentUid),scheduledDate,isTeamAssigned:true});
  });
  state.members.forEach(member=>{
    const uid=member.uid,days=state.days.get(uid)||new Map();
    days.forEach((day,sourceDate)=>(Array.isArray(day.appointments)?day.appointments:[]).forEach(a=>{
      if(appointmentType(a)==='OFI')return;const id=String(a.id||''),scheduledDate=appointmentScheduledDate(a,sourceDate),resourceKey=String(member.teamId||'solo'),fallback=[resourceKey,scheduledDate,a.time,a.address,a.contactName,appointmentType(a)].map(value=>String(value||'').trim().toLowerCase()).join('|'),key=id?`id:${resourceKey}:${id}`:`fallback:${fallback}`,agentUid=String(a.assignedToUid||uid),existing=map.get(key)||{};
      map.set(key,{...existing,...a,id:id||fallback,sourceDate,agentUid,agentName:a.assignedToName||memberName(agentUid),setterUid:String(a.setterUid||uid),scheduledDate,isTeamAssigned:Boolean(a.assignedToUid&&a.assignedToUid!==uid)||Boolean(existing.isTeamAssigned)});
    }));
  });
  const rows=[...map.values()].sort((a,b)=>appointmentTimestamp(a,a.sourceDate)-appointmentTimestamp(b,b.sourceDate));
  return scopeIsTeam()?rows:rows.filter(a=>a.agentUid===scopeId());
}
function appointmentBookedDate(a={}){return a.createdDate||a.logDate||a.sourceDate||''}
function appointmentsBookedForPeriod(){const keys=new Set(periodKeys());return allAppointments().filter(a=>keys.has(appointmentBookedDate(a)))}
function appointmentsScheduledForPeriod(){const keys=new Set(periodKeys());return allAppointments().filter(a=>keys.has(a.scheduledDate||appointmentScheduledDate(a,a.sourceDate)))}
function periodUpcomingAppointments(){const keys=new Set(periodKeys());return allAppointments().filter(a=>keys.has(appointmentBookedDate(a))&&appointmentTimestamp(a,a.sourceDate)>=Date.now()-60*60*1000)}
function periodCompletedAppointments(){const keys=new Set(periodKeys());return allAppointments().filter(a=>keys.has(a.scheduledDate||appointmentScheduledDate(a,a.sourceDate))&&appointmentTimestamp(a,a.sourceDate)<Date.now()&&isOutcomeClosed(a))}
function periodAttentionAppointments(){const keys=new Set(periodKeys());return allAppointments().filter(a=>keys.has(a.scheduledDate||appointmentScheduledDate(a,a.sourceDate))&&isAppointmentAttention(a,a.sourceDate))}

function metricCard(label,value,meta='',tone=''){return`<article class="metric-card ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(meta)}</small></article>`}
function renderMetrics(){
  if(!reportingReady()){const waiting=metricCard('Waiting','—','current data');$('#metricGrid').innerHTML=waiting.repeat(4);return}
  const data=teamAggregate();const connectRate=data.calls?Math.round(data.connects/data.calls*100):0,periodLabel=state.period==='today'?'today':state.period==='week'?'this week':'last 4 weeks';
  $('#metricGrid').innerHTML=[metricCard('Completion',`${data.score}%`,periodLabel),metricCard('Calls',data.calls,periodLabel),metricCard('Connect rate',`${connectRate}%`,`${data.connects} connects`),metricCard('Appointments',data.appointments,'booked in period')].join('');
}
function renderBrief(){
  const setBrief=(value,label,title,copy)=>{$('#teamScore').textContent=value;$('#scoreLabel').textContent=label;$('#briefTitle').textContent=title;$('#briefCopy').textContent=copy};
  if(!state.resources.length){setBrief('—','reporting access',state.managerProfile?'Connect your first team or solo agent.':'No reporting authority is active.',state.managerProfile?'Open Access and send an approval link to the team leader or solo agent.':'Open Access to review or approve a management request.');return}
  if(!reportingReady()){setBrief('—','syncing','MNGR is confirming current team data.','The management priority will appear once current reporting access is verified.');return}
  const health=periodAgentHealth(),offTrack=health.filter(item=>item.status==='off-track'),atRisk=health.filter(item=>item.status==='at-risk'),onTrack=health.filter(item=>item.status==='on-track'),missing=health.filter(item=>item.status==='no-data'),syncing=health.filter(item=>item.status==='syncing'),attention=periodAttentionAppointments().length,upcoming=periodUpcomingAppointments().length,label=periodLabel();
  if(!scopeIsTeam()){
    const name=scopeName(),item=health[0];
    if(!item||!item.hasData){setBrief('—',label,`${name} has no reporting data for ${label}.`,`${upcoming} upcoming appointment${upcoming===1?' was':'s were'} created in the selected period.`);return}
    if(item.status==='off-track'){setBrief(`${item.aggregate.score}%`,label,`${name} is off track ${label}.`,`${item.aggregate.calls} calls · ${item.aggregate.connects} connects · ${item.aggregate.appointments} appointments.`);return}
    if(item.status==='at-risk'){setBrief(`${item.aggregate.score}%`,label,`${name} is at risk ${label}.`,`${item.aggregate.calls} calls · ${item.aggregate.connects} connects · ${item.aggregate.appointments} appointments.`);return}
    if(attention){setBrief(attention,`open ${label}`,`${name} is on track, with ${attention} outcome${attention===1?'':'s'} still open.`,`${item.aggregate.calls} calls · ${item.aggregate.connects} connects · ${item.aggregate.appointments} appointments.`);return}
    setBrief(`${item.aggregate.score}%`,label,`${name} is on track ${label}.`,`${item.aggregate.calls} calls · ${item.aggregate.connects} connects · ${item.aggregate.appointments} appointments.`);return
  }
  const context=[atRisk.length?`${atRisk.length} at risk`:'',attention?`${attention} outcome${attention===1?'':'s'} open`:'',missing.length?`${missing.length} with no data`:'',syncing.length?`${syncing.length} syncing`:''].filter(Boolean).join(' · ')||`${upcoming} upcoming appointment${upcoming===1?' was':'s were'} created ${label}`;
  if(offTrack.length){setBrief(offTrack.length,'off track',`${offTrack.length} agent${offTrack.length===1?' is':'s are'} off track ${label}.`,context);return}
  if(atRisk.length){setBrief(atRisk.length,'at risk',`${atRisk.length} agent${atRisk.length===1?' is':'s are'} at risk ${label}.`,attention?`${attention} appointment outcome${attention===1?' is':'s are'} also open.`:`${onTrack.length} agent${onTrack.length===1?' is':'s are'} on track.`);return}
  if(attention){setBrief(attention,'open outcomes',`Activity is on track, with ${attention} outcome${attention===1?'':'s'} still open ${label}.`,`${upcoming} upcoming appointment${upcoming===1?' was':'s were'} created in the selected period.`);return}
  if(missing.length){setBrief(missing.length,'no data',`${missing.length} agent${missing.length===1?' has':'s have'} no reporting data for ${label}.`,`${onTrack.length} agent${onTrack.length===1?' is':'s are'} currently on track.`);return}
  if(syncing.length){setBrief(syncing.length,'syncing',`${syncing.length} agent${syncing.length===1?' is':'s are'} still syncing.`,`${onTrack.length} agent${onTrack.length===1?' is':'s are'} currently on track.`);return}
  setBrief(onTrack.length,'on track',scopeType()==='all'?`The portfolio is on track ${label}.`:`The team is on track ${label}.`,`${upcoming} upcoming appointment${upcoming===1?' was':'s were'} created in the selected period.`);
}
function renderAgentPulse(){
  const rows=periodAgentHealth().slice(0,5).map(({member,aggregate,hasData,status,label,expectedDays})=>{const meta=hasData?`${aggregate.calls} calls · ${aggregate.connects} connects · ${aggregate.appointments} appts`:status==='syncing'?'Reporting data is loading':expectedDays?`No activity for ${periodLabel()}`:'No scheduled days yet';return`<article class="agent-row week-${status}"><div class="agent-name"><strong>${esc(memberName(member.uid))}</strong><small>${esc(meta)}</small></div><div class="agent-week-status"><span>${esc(label)}</span><strong>${hasData?`${aggregate.score}%`:'—'}</strong></div></article>`}).join('');
  $('#agentPulse').innerHTML=rows||'<div class="empty">No team members found.</div>';
}
function appointmentRow(a,{full=false}={}){const key=a.scheduledDate||appointmentScheduledDate(a,a.sourceDate),type=appointmentType(a),outcome=appointmentOutcome(a),attention=isAppointmentAttention(a,a.sourceDate),time=String(a.time||'12:00'),contact=a.contactName||a.name||'Contact not recorded',address=a.address||'Address not recorded',tag=attention?'Outcome due':outcome||type;return`<article class="appointment-row"><div class="appointment-time"><strong>${esc(formatDate(key,{weekday:true}))}</strong>${esc(time)}</div><div class="appointment-copy"><strong>${esc(contact)}</strong><small>${esc(address)}</small></div>${full?`<div class="appointment-agent">${esc(a.agentName||memberName(a.agentUid))}</div><div class="appointment-outcome"><strong>${esc(outcome||'Outcome not recorded')}</strong><small>${esc(a.followUpDate?`Follow-up ${formatDate(a.followUpDate)}`:attention?'Manager attention':'')}</small></div>`:''}<span class="tag ${attention?'attention':type}">${esc(tag)}</span></article>`}
function renderUpcomingPreview(){const list=periodUpcomingAppointments().slice(0,5);$('#upcomingPreview').innerHTML=list.map(a=>appointmentRow(a)).join('')||`<div class="empty">No upcoming appointments were created ${esc(periodLabel())}.</div>`}
function activityBuckets(period=state.period){
  const keys=periodKeys(period),groups=[];
  if(period==='four')for(let index=0;index<keys.length;index+=7)groups.push(keys.slice(index,index+7));else keys.forEach(key=>groups.push([key]));
  const visibleIds=new Set(scopedMembers().map(member=>member.uid)),records=[];
  state.leaderboard.filter(entry=>visibleIds.has(entry.uid)).forEach(entry=>records.push(...historyRecords(entry,period)));
  return groups.map(group=>{const set=new Set(group),first=parseKey(group[0]),calls=sum(records.filter(record=>set.has(record.date)),'calls'),appointments=sum(records.filter(record=>set.has(record.date)),record=>sum(TYPES,type=>record.appointments?.[type]));return{label:new Intl.DateTimeFormat('en-AU',period==='four'?{day:'numeric',month:'short'}:{weekday:'short'}).format(first),calls,appointments}});
}
function trendMarkup(buckets){const maxValue=Math.max(1,...buckets.flatMap(item=>[item.calls,item.appointments]));return`${buckets.map(item=>`<div class="trend-column" title="${item.calls} calls · ${item.appointments} appointments"><div class="trend-bars"><i style="height:${item.calls?Math.max(2,item.calls/maxValue*100):0}%"></i><i style="height:${item.appointments?Math.max(2,item.appointments/maxValue*100):0}%"></i></div><small>${esc(item.label)}</small></div>`).join('')}<div class="trend-legend"><span><i></i>Calls</span><span><i></i>Appointments</span></div>`}
function renderOverviewTrend(){const node=$('#overviewTrend');node.style.position='relative';node.innerHTML=trendMarkup(activityBuckets())}

function directionFor(entry,period=state.period){const records=historyRecords(entry,period),half=Math.ceil(records.length/2),prior=mean(records.slice(0,half),'score'),recent=mean(records.slice(half),'score'),diff=records.length<2?0:recent-prior;return diff>=5?{label:`↑ ${diff}%`,className:'direction-up'}:diff<=-5?{label:`↓ ${Math.abs(diff)}%`,className:'direction-down'}:{label:'→ Steady',className:''}}
function renderTeamCards(){
  $('#teamCards').innerHTML=periodAgentHealth().map(({member,entry,aggregate:data,hasData})=>{const live=state.leaderboard.find(item=>item.uid===member.uid),direction=live?directionFor(entry):{label:'Waiting',className:''},connectRate=data.calls?Math.round(data.connects/data.calls*100):0,meta=!live?'Waiting for current data':member.role==='owner'?'Team owner':data.scheduledDays?`${data.scheduledDays} elapsed scheduled day${data.scheduledDays===1?'':'s'}`:'No scheduled activity in period',display=hasData?value=>value:()=> '—';return`<article class="team-card"><div class="team-card-head"><div class="team-person"><span class="avatar">${esc(initials(memberName(member.uid)))}</span><div><strong>${esc(memberName(member.uid))}</strong><small>${esc(meta)}</small></div></div><span class="score-ring" style="--score:${hasData?clamp(data.score)*3.6:0}deg"><b>${hasData?`${data.score}%`:'—'}</b></span></div><div class="team-metrics"><div><strong>${display(data.calls)}</strong><span>Calls</span></div><div><strong>${display(data.connects)}</strong><span>Connects</span></div><div><strong>${display(data.data)}</strong><span>Data</span></div><div><strong>${display(data.appointments)}</strong><span>Appts</span></div></div><div class="team-card-foot"><span>${hasData?`${connectRate}% connect rate · ${data.knock}m knocking`:'Current data not yet available'}</span><strong class="${direction.className}">${esc(direction.label)}</strong></div></article>`}).join('')||'<div class="empty">No verified team members found.</div>';
}

function renderAppointmentStats(){const booked=appointmentsBookedForPeriod(),scheduled=appointmentsScheduledForPeriod(),upcoming=periodUpcomingAppointments(),completed=periodCompletedAppointments(),attention=periodAttentionAppointments();$('#appointmentStats').innerHTML=[metricCard('Booked',booked.length,periodLabel()),metricCard('Scheduled',scheduled.length,periodLabel()),metricCard('Upcoming',upcoming.length,'created in period'),metricCard('Outcomes',completed.length,'scheduled in period'),metricCard('Outcome overdue',attention.length,'scheduled in period',attention.length?'critical':'good')].join('')}
function renderAppointmentFilters(){const select=$('#appointmentAgentFilter');if(!scopeIsTeam()){state.appointmentAgent=scopeId();select.innerHTML=`<option value="${esc(scopeId())}">${esc(scopeName())}</option>`;select.value=scopeId();select.disabled=true;return}const value=state.appointmentAgent;select.disabled=false;select.innerHTML='<option value="all">All agents</option>'+state.members.map(member=>`<option value="${esc(member.uid)}">${esc(memberName(member.uid))}</option>`).join('');select.value=state.members.some(member=>member.uid===value)?value:'all';state.appointmentAgent=select.value}
function renderAppointmentList(){let list=state.appointmentMode==='upcoming'?periodUpcomingAppointments():state.appointmentMode==='outcomes'?periodCompletedAppointments():periodAttentionAppointments();if(state.appointmentAgent!=='all')list=list.filter(a=>a.agentUid===state.appointmentAgent);if(state.appointmentMode!=='upcoming')list=[...list].sort((a,b)=>appointmentTimestamp(b,b.sourceDate)-appointmentTimestamp(a,a.sourceDate));$('#appointmentList').innerHTML=list.map(a=>appointmentRow(a,{full:true})).join('')||`<div class="empty">No ${state.appointmentMode==='upcoming'?'upcoming appointments created':state.appointmentMode==='outcomes'?'recorded outcomes scheduled':'overdue outcomes scheduled'} ${esc(periodLabel())}.</div>`}

function renderTrends(){
  const data=teamAggregate(),connectRate=data.calls?Math.round(data.connects/data.calls*100):0,appointmentRate=data.connects?Math.round(data.appointments/data.connects*100):0,dataRate=data.connects?Math.round(data.data/data.connects*100):0;
  $('#trendSummary').innerHTML=[metricCard('Calls',data.calls,periodLabel()),metricCard('Connect rate',`${connectRate}%`,`${data.connects} connects`),metricCard('Appointment rate',`${appointmentRate}%`,'appointments per connect'),metricCard('Data rate',`${dataRate}%`,'data per connect'),metricCard('Avg completion',`${data.score}%`,'selected period'),metricCard('Knocking',`${data.knock}m`,periodLabel())].join('');
  const chart=$('#mainTrendChart');chart.style.position='relative';chart.innerHTML=trendMarkup(activityBuckets(),true);
  $('#conversionList').innerHTML=[['Connect rate',connectRate,55],['Appointment rate',appointmentRate,20],['Data capture',dataRate,40]].map(([label,value,target])=>`<article class="conversion-item"><div><span>${esc(label)}<small>Target ${target}%</small></span><strong>${value}%</strong></div><div class="progress"><i style="width:${clamp(value)}%"></i></div></article>`).join('');
  $('#trendTable').innerHTML=periodAgentHealth().map(({member,entry,aggregate:agentData,hasData})=>{const direction=directionFor(entry),connect=agentData.calls?Math.round(agentData.connects/agentData.calls*100):0,name=memberName(member.uid),score=hasData?`${agentData.score}%`:'—',meta=hasData?`${agentData.scheduledDays} days · ${agentData.calls} calls · ${connect}% connect · ${agentData.appointments} appts · ${direction.label}`:'No elapsed scheduled data';return`<tr><td><strong>${esc(name)}</strong><small class="mobile-trend-meta">${esc(meta)}</small></td><td>${agentData.scheduledDays}</td><td>${score}</td><td>${agentData.calls}</td><td>${connect}%</td><td>${agentData.appointments}</td><td class="${direction.className}">${esc(direction.label)}</td></tr>`}).join('');
}

function renderPeriodLabels(){
  const labels={agentHealthPeriod:periodEyebrow(),upcomingPeriod:'UPCOMING · '+periodEyebrow(),snapshotPeriod:periodEyebrow()+' SNAPSHOT',momentumPeriod:periodEyebrow(),trendPeriod:periodEyebrow()};
  Object.entries(labels).forEach(([id,value])=>{const node=$(`#${id}`);if(node)node.textContent=value});
}

function openAccessSheet(){$('#accessSheet').classList.remove('hidden');renderAccess()}
function closeAccessSheet(){$('#accessSheet').classList.add('hidden')}
async function copyText(value,button){try{await navigator.clipboard.writeText(value);if(button){const original=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=original,1400)}}catch{$('#newRequestResult').classList.remove('hidden');$('#newRequestResult').innerHTML=`<strong>Copy this approval link</strong><p>${esc(value)}</p>`}}
async function shareRequestLink(id,resourceType,button){const link=requestLink(id),title=`MNGR ${resourceType==='team'?'team':'agent'} access request`;if(navigator.share){try{await navigator.share({title,text:'Open this secure link and sign in to approve management reporting access.',url:link});return}catch(error){if(error?.name==='AbortError')return}}await copyText(link,button)}
function requestLink(id){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('request',id);return url.toString()}
async function createAccessRequest(resourceType){
  if(!state.managerProfile)return;
  const requestRef=doc(collection(db,'managementRequests')),expiresAt=Timestamp.fromMillis(Date.now()+7*24*60*60*1000),payload={managerUid:state.user.uid,managerName:managerDisplayName(),managerEmail:state.user.email||'',resourceType,status:'pending',createdAt:serverTimestamp(),expiresAt};
  try{await setDoc(requestRef,payload);const link=requestLink(requestRef.id),result=$('#newRequestResult');result.classList.remove('hidden');result.innerHTML=`<strong>${resourceType==='team'?'Team leader':'Solo agent'} approval link</strong><p>${esc(link)}</p><button class="secondary" type="button">Share approval link</button>`;result.querySelector('button').addEventListener('click',event=>shareRequestLink(requestRef.id,resourceType,event.currentTarget))}catch(error){console.error(error);setNotice('The access request could not be created. Check the published MNGR rules and try again.')}
}
async function activateManagerProfile(){const name=state.profile?.name||state.user.displayName||state.user.email?.split('@')[0]||'Manager';try{await setDoc(doc(db,'managerProfiles',state.user.uid),{uid:state.user.uid,name,email:state.user.email||'',accountType:'manager',createdAt:serverTimestamp()});state.managerProfile={uid:state.user.uid,name,email:state.user.email||'',accountType:'manager'};renderAccess()}catch(error){console.error(error);setNotice('Manager tools could not be activated. Check the published MNGR rules and try again.')}}
async function approvePendingRequest(resource){
  const request=state.pendingRequest;if(!request||request.status!=='pending')return;const requestRef=doc(db,'managementRequests',request.id),grantId=`${request.resourceType}__${resource.id}`,grantRef=doc(db,'managerAccess',request.managerUid,'grants',grantId),batch=writeBatch(db),now=serverTimestamp();
  batch.update(requestRef,{status:'approved',resourceId:resource.id,resourceName:resource.name,grantedByUid:state.user.uid,approvedAt:now});
  batch.set(grantRef,{managerUid:request.managerUid,managerName:request.managerName||'Manager',managerEmail:request.managerEmail||'',resourceType:request.resourceType,resourceId:resource.id,resourceName:resource.name,grantedByUid:state.user.uid,requestId:request.id,status:'active',grantedAt:now});
  try{await batch.commit();state.pendingRequest={...request,status:'approved',resourceId:resource.id,resourceName:resource.name};history.replaceState({},'',location.pathname);renderAccess()}catch(error){console.error(error);$('#approvalCopy').textContent='Approval could not be completed. Confirm you are the team owner or the solo agent named in this request.'}
}
async function cancelRequest(id){try{await updateDoc(doc(db,'managementRequests',id),{status:'cancelled',cancelledAt:serverTimestamp()})}catch(error){console.error(error);setNotice('The pending request could not be cancelled.')}}
async function revokeGrant(grant){try{await updateDoc(doc(db,'managerAccess',grant.managerUid||state.user.uid,'grants',grant.id||`${grant.resourceType}__${grant.resourceId}`),{status:'revoked',revokedAt:serverTimestamp(),revokedByUid:state.user.uid})}catch(error){console.error(error);setNotice('Management access could not be revoked. Confirm the current account issued or owns this access.')}}
function renderApprovalRequest(){
  const panel=$('#approvalPanel'),request=state.pendingRequest;if(!request){panel.classList.add('hidden');return}panel.classList.remove('hidden');const title=$('#approvalTitle'),copy=$('#approvalCopy'),actions=$('#approvalActions');actions.innerHTML='';
  if(request.status==='approved'){title.textContent='Access approved';copy.textContent=`${request.managerName||'The manager'} can now view ${request.resourceName||'the approved reporting resource'}.`;return}
  if(request.status!=='pending'){title.textContent='This request is no longer active';copy.textContent='Ask the manager to create a new approval link if access is still required.';return}
  title.textContent=`${request.managerName||'A manager'} is requesting access`;copy.textContent=request.resourceType==='team'?'Approve access to one team you lead. The manager will receive read-only reporting visibility across that team.':'Approve access to your individual AGNT reporting. This is available only while you are not part of a team.';
  if(request.resourceType==='team'){
    if(!state.ownedResources.length){copy.textContent='This request needs to be opened by the verified leader of the team being managed.';return}
    state.ownedResources.forEach(resource=>{const button=document.createElement('button');button.className='primary';button.type='button';button.textContent=`Approve ${resource.name}`;button.addEventListener('click',()=>approvePendingRequest(resource));actions.append(button)});
  }else{
    const teamId=String(state.profile?.teamId||''),isSolo=state.agentProfileExists&&!teamId&&state.profile?.accountMode!=='team';if(!isSolo){copy.textContent=state.agentProfileExists?'You are currently attached to an AGNT team. The manager must request access from your team leader instead.':'This request must be opened by an existing solo AGNT agent.';return}const resource={id:state.user.uid,name:state.profile?.name||state.user.displayName||state.user.email?.split('@')[0]||'Solo agent'};const button=document.createElement('button');button.className='primary';button.type='button';button.textContent='Approve my reporting';button.addEventListener('click',()=>approvePendingRequest(resource));actions.append(button)
  }
}
function accessRow(title,meta,action='',actionClass=''){return`<article class="access-row"><div class="access-row-copy"><strong>${esc(title)}</strong><small>${esc(meta)}</small></div>${action?`<button class="${actionClass}" type="button">${esc(action)}</button>`:''}</article>`}
function renderAccess(){
  if(!state.user)return;renderApprovalRequest();const isManager=Boolean(state.managerProfile);$('#managerRequestPanel').classList.toggle('hidden',!isManager);$('#managerActivationPanel').classList.toggle('hidden',isManager);$('#pendingRequestsPanel').classList.toggle('hidden',!isManager);
  const resources=$('#managedResources');resources.innerHTML=state.resources.map(resource=>accessRow(resource.name,resource.access==='owner'?'Team leader access':'Approved management access',resource.access==='grant'?'Relinquish':'' ,resource.access==='grant'?'danger':'')).join('')||'<div class="empty-access">No reporting access is active yet.</div>';resources.querySelectorAll('.access-row').forEach((row,index)=>{const resource=state.resources[index];row.querySelector('button')?.addEventListener('click',()=>revokeGrant({...resource,managerUid:state.user.uid,resourceType:resource.type,resourceId:resource.id,id:resource.grantId}))});
  const approvals=$('#givenApprovals');approvals.innerHTML=state.givenApprovals.map(grant=>accessRow(grant.managerName||grant.managerEmail||'Manager',`${grant.resourceName} · ${grant.resourceType==='team'?'Team access':'Individual access'}`,'Revoke','danger')).join('')||'<div class="empty-access">You have not approved any active managers.</div>';approvals.querySelectorAll('.access-row').forEach((row,index)=>row.querySelector('button')?.addEventListener('click',()=>revokeGrant(state.givenApprovals[index])));
  const pending=$('#pendingRequests');pending.innerHTML=state.pendingRequests.map(request=>`<article class="access-row"><div class="access-row-copy"><strong>${request.resourceType==='team'?'Team access request':'Solo agent request'}</strong><small>Expires ${request.expiresAt?.toDate?request.expiresAt.toDate().toLocaleDateString('en-AU'):'in 7 days'}</small></div><div class="access-row-actions"><button type="button" data-action="share">Share</button><button class="danger" type="button" data-action="cancel">Cancel</button></div></article>`).join('')||'<div class="empty-access">No requests are awaiting approval.</div>';pending.querySelectorAll('.access-row').forEach((row,index)=>{const request=state.pendingRequests[index],shareButton=row.querySelector('[data-action="share"]');shareButton?.addEventListener('click',()=>shareRequestLink(request.id,request.resourceType,shareButton));row.querySelector('[data-action="cancel"]')?.addEventListener('click',()=>cancelRequest(request.id))});
}

function renderScopeControl(){
  const select=$('#scopeSelect'),allMembers=allResourceMembers();
  if(scopeType()==='agent'&&!allMembers.some(member=>member.uid===scopeId()))state.scopeKey='all';
  if(scopeType()==='team'&&!state.resources.some(resource=>resource.key===state.scopeKey))state.scopeKey='all';
  const teamOptions=state.resources.filter(resource=>resource.type==='team').map(resource=>`<option value="${esc(resource.key)}">${esc(resource.name)}</option>`),agentMap=new Map();state.resourceData.forEach(data=>data.members.forEach(member=>agentMap.set(member.uid,{...member,resourceName:data.resource.name})));const agentOptions=[...agentMap.values()].sort((a,b)=>String(a.name||a.email||'').localeCompare(String(b.name||b.email||''))).map(member=>`<option value="agent:${esc(member.uid)}">${esc(member.name||member.email?.split('@')[0]||'Team member')}</option>`);
  select.innerHTML='<option value="all">All Managed</option>'+(teamOptions.length?`<optgroup label="Teams">${teamOptions.join('')}</optgroup>`:'')+(agentOptions.length?`<optgroup label="Agents">${agentOptions.join('')}</optgroup>`:'');select.value=state.scopeKey;$('#scopeTitle').textContent=scopeName();
  const dayStatuses=scopedMembers().map(member=>state.sources.days.get(member.uid)||'loading'),resourceStatuses=[...state.sources.resources.entries()].filter(([key])=>scopeType()==='all'||scopeType()==='team'&&key.startsWith(`${state.scopeKey}:`)||scopeType()==='agent'&&[...state.resourceData.values()].some(data=>data.members.some(member=>member.uid===scopeId())&&key.startsWith(`${data.resource.key}:`))).map(([,status])=>status),statuses=[...resourceStatuses,...dayStatuses],health=reportingErrorCount()?'Access issue':statuses.some(status=>status==='loading')?'Syncing':statuses.some(status=>status==='cached')?'Cached':'Live';
  const teams=state.resources.filter(resource=>resource.type==='team').length;if(scopeType()==='all')$('#scopeMeta').textContent=`Portfolio · ${teams} team${teams===1?'':'s'} · ${state.members.length} agent${state.members.length===1?'':'s'} · ${health}`;else if(scopeType()==='team')$('#scopeMeta').textContent=`Team · ${state.members.length} agent${state.members.length===1?'':'s'} · ${health}`;else $('#scopeMeta').textContent=`Agent · ${health}`;$('#scoreLabel').textContent=scopeType()==='all'?'portfolio completion':scopeIsTeam()?'team completion':'agent completion';
}
function render(){if($('#app').classList.contains('hidden'))return;if(scopeType()==='agent'&&!allResourceMembers().some(member=>member.uid===scopeId()))state.scopeKey='all';if(scopeType()==='team'&&!state.resources.some(resource=>resource.key===state.scopeKey))state.scopeKey='all';applyScopeData();renderScopeControl();renderHeader();renderPeriodLabels();renderBrief();renderMetrics();renderAgentPulse();renderUpcomingPreview();renderOverviewTrend();renderTeamCards();renderAppointmentStats();renderAppointmentFilters();renderAppointmentList();renderTrends()}
function resetViewScroll(node){if(!node)return;node.scrollTop=0;requestAnimationFrame(()=>{node.scrollTop=0})}
function switchView(view){state.view=view;$$('.nav-item').forEach(button=>{const active=button.dataset.view===view;button.classList.toggle('active',active);button.toggleAttribute('aria-current',active)});$$('.view').forEach(node=>node.classList.toggle('active',node.id===`${view}View`));renderHeader();resetViewScroll($(`#${view}View`))}

$('#loginForm').addEventListener('submit',async event=>{event.preventDefault();const button=$('#loginButton');button.disabled=true;button.textContent='Signing in…';$('#authMessage').textContent='';try{await signInWithEmailAndPassword(auth,$('#email').value.trim(),$('#password').value)}catch(error){$('#authMessage').textContent=friendlyAuthError(error)}finally{button.disabled=false;button.textContent='Sign in'}});
$('#signupForm').addEventListener('submit',async event=>{event.preventDefault();const button=$('#signupButton'),name=$('#signupName').value.trim();button.disabled=true;button.textContent='Creating…';$('#authMessage').textContent='';try{const credential=await createUserWithEmailAndPassword(auth,$('#signupEmail').value.trim(),$('#signupPassword').value);await updateProfile(credential.user,{displayName:name});await setDoc(doc(db,'managerProfiles',credential.user.uid),{uid:credential.user.uid,name,email:credential.user.email||'',accountType:'manager',createdAt:serverTimestamp()});await startManager(credential.user);openAccessSheet()}catch(error){console.error(error);$('#authMessage').textContent=friendlyAuthError(error)}finally{button.disabled=false;button.textContent='Create manager account'}});
$('#showSignup').addEventListener('click',()=>{$('#loginForm').classList.add('hidden');$('#showSignup').classList.add('hidden');$('#signupForm').classList.remove('hidden');$('#authMessage').textContent=''});
$('#showLogin').addEventListener('click',()=>{$('#signupForm').classList.add('hidden');$('#loginForm').classList.remove('hidden');$('#showSignup').classList.remove('hidden');$('#authMessage').textContent=''});
$('#signOut').addEventListener('click',()=>signOut(auth));$('#accessSignOut').addEventListener('click',()=>signOut(auth));
$('#accessButton').addEventListener('click',openAccessSheet);$('#closeAccess').addEventListener('click',closeAccessSheet);$('#requestTeamAccess').addEventListener('click',()=>createAccessRequest('team'));$('#requestAgentAccess').addEventListener('click',()=>createAccessRequest('agent'));
$('#activateManager').addEventListener('click',activateManagerProfile);
$$('.nav-item').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.view)));
$$('[data-go]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.go)));
$('#periodSelect').addEventListener('change',event=>{state.period=event.target.value;render();resetViewScroll($('.view.active'))});
$('#scopeSelect').addEventListener('change',event=>{state.scopeKey=event.target.value;state.appointmentAgent=scopeIsTeam()?'all':scopeId();render();resetViewScroll($('.view.active'))});
$('#appointmentAgentFilter').addEventListener('change',event=>{state.appointmentAgent=event.target.value;renderAppointmentList()});
$$('[data-appointment-mode]').forEach(button=>button.addEventListener('click',()=>{state.appointmentMode=button.dataset.appointmentMode;$$('[data-appointment-mode]').forEach(item=>item.classList.toggle('active',item===button));renderAppointmentList()}));
$('#refreshData').addEventListener('click',()=>{const button=$('#refreshData');button.classList.add('loading');button.disabled=true;setTimeout(()=>window.location.reload(),180)});

onAuthStateChanged(auth,user=>{if(user)startManager(user);else{stopSubscriptions();state.user=null;state.teamId='';state.team=null;boundSignature='';showOnly('authView')}});
if('serviceWorker'in navigator)window.addEventListener('load',async()=>{const reloadOnce=()=>{const key='mngr:controller-reload:2.6.0';if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1');location.reload()};navigator.serviceWorker.addEventListener('controllerchange',reloadOnce);try{const registration=await navigator.serviceWorker.register('./service-worker.js?v=2.6.0',{updateViaCache:'none'});await registration.update()}catch(error){console.error(error)}});
