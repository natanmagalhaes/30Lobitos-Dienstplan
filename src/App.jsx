import React from "react";
const { useState, useEffect, useMemo, useCallback, useRef } = React;
import { supabase } from "./supabaseClient.js";

/* ================================================================== *
 * Kita 30 Lobitos — Shift Plan v5
 * ================================================================== */

const STORAGE_KEY = "kita30-dienstplan-v8";
const DAYS = ["Mon","Tue","Wed","Thu","Fri"];
const DAY_NAMES = {Mon:"Monday",Tue:"Tuesday",Wed:"Wednesday",Thu:"Thursday",Fri:"Friday"};

const C = {
  bg:"#F6F4EF", surface:"#FFFFFF", ink:"#23282E", muted:"#737A82",
  faint:"#9AA0A6", line:"#E5E0D6", lineSoft:"#EFEBE2",
  primary:"#2E6E66", primaryDark:"#234F49", primarySoft:"#E4EEEC",
  ok:"#3F8F5B", okBg:"#E9F3EC", tight:"#A9791A", tightBg:"#F8F0D9",
  gap:"#B0443B", gapBg:"#F6E1DE", springer:"#5A4E8C", springerBg:"#ECE9F4",
  warn:"#7B5EA7", warnBg:"#F0EBF8",
  kitchen:"#2E6E66", cleaning:"#5A4E8C", eltern:"#A9791A",
};
const FONT = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";

const DEFAULT_SHIFTS = [
  {code:"A",  label:"08:00–13:00", time:"08:00–13:00", start:8,   end:13,  hours:5, work:true},
  {code:"A+", label:"08:00–14:00", time:"08:00–14:00", start:8,   end:14,  hours:6, work:true},
  {code:"B",  label:"09:00–15:00", time:"09:00–15:00", start:9,   end:15,  hours:6, work:true},
  {code:"B+", label:"09:30–15:30", time:"09:30–15:30", start:9.5, end:15.5,hours:6, work:true},
  {code:"C",  label:"10:30–16:30", time:"10:30–16:30", start:10.5,end:16.5,hours:6, work:true},
  {code:"D",  label:"11:00–17:00", time:"11:00–17:00", start:11,  end:17,  hours:6, work:true},
  {code:"E+", label:"09:30–17:00 (incl. break)",time:"09:30–17:00",start:9.5,end:17,hours:7,work:true},
  {code:"E-4",    label:"4 hours",          time:"",start:null,end:null,hours:4,work:true},
  {code:"L-8",    label:"Lina 8h",           time:"",start:null,end:null,hours:8,work:true},
  {code:"Training",label:"Further training", time:"",start:null,end:null,hours:6,work:true},
  {code:"Off",     label:"free day",         time:"",start:null,end:null,hours:0,work:false,absence:true},
  {code:"Vacation",label:"annual leave",     time:"",start:null,end:null,hours:0,work:false,vacation:true,absence:true},
  {code:"Sick",    label:"sick",             time:"",start:null,end:null,hours:0,work:false,sick:true,absence:true},
  {code:"Sick-K",  label:"child sick",       time:"",start:null,end:null,hours:0,work:false,sick:true,absence:true},
  {code:"Holiday", label:"public holiday",   time:"",start:null,end:null,hours:0,work:false,holiday:true,absence:true},
  {code:"Limpieza",label:"Limpieza (cleaning)", time:"xx:xx-xx:xx",start:null,end:null,hours:4,work:true},
  {code:"Cocina",  label:"Cocina (kitchen)",    time:"xx:xx-xx:xx",start:null,end:null,hours:3,work:true},
  {code:"FFU",     label:"Freizeitausgleich",   time:"",start:null,end:null,hours:0,work:false,absence:true},
];

const A_FULL = {Mon:"full",Tue:"full",Wed:"full",Thu:"full",Fri:"full"};
function mkPerson(name,weeklyHours,daysPerWeek,opts) {
  opts = opts || {};
  return {
    id:"p-"+name.toLowerCase().replace(/[^a-z0-9]+/g,"-"),
    name, weeklyHours, daysPerWeek,
    tsHours: opts.ts !== undefined ? opts.ts : 2.5,
    coverage: opts.coverage !== undefined ? opts.coverage : true,
    springer: opts.springer || false,
    kitchen:  opts.kitchen  || false,
    cleaning: opts.cleaning || false,
    eltern:   opts.eltern   || false,
    vacationAllowance: opts.vac !== undefined ? opts.vac : 30,
    startOvertime: opts.ot || 0,
    springerHoursLimit: opts.springerHoursLimit !== undefined ? opts.springerHoursLimit : 0,
    springerHoursUsed:  opts.springerHoursUsed  !== undefined ? opts.springerHoursUsed  : 0,
    qualifications: opts.qual || [],
    availability: Object.assign({},A_FULL),
    note:"", active:true,
  };
}

const DEFAULT_TEAM = [
  mkPerson("Michaella",16,3,{qual:["Fachkraft"]}),
  mkPerson("Ileana",30,5,{qual:["Fachkraft","Leitung"]}),
  mkPerson("Maria",30,5,{qual:["Fachkraft"]}),
  mkPerson("Emma",24,4,{qual:["Fachkraft"]}),
  mkPerson("Marcela",24,4,{qual:["Fachkraft"]}),
  mkPerson("Fernando",24,4,{qual:["Fachkraft"]}),
  mkPerson("Ina",24,4,{qual:["Fachkraft"]}),
  mkPerson("Praktikant*in",30,5,{ts:0,vac:0,qual:["Trainee"]}),
  mkPerson("FSJ",30,5,{ts:0,vac:26,qual:["FSJ"]}),
  mkPerson("Springer 1",0,0,{ts:0,vac:0,springer:true,springerHoursLimit:200,springerHoursUsed:0}),
  mkPerson("Springer 2",0,0,{ts:0,vac:0,springer:true,springerHoursLimit:200,springerHoursUsed:0}),
  mkPerson("Springer 3",0,0,{ts:0,vac:0,springer:true,springerHoursLimit:200,springerHoursUsed:0}),
  mkPerson("Elterndienst 1",0,0,{ts:0,vac:0,eltern:true,qual:["Parent"]}),
  mkPerson("Elterndienst 2",0,0,{ts:0,vac:0,eltern:true,qual:["Parent"]}),
  mkPerson("Elterndienst 3",0,0,{ts:0,vac:0,eltern:true,qual:["Parent"]}),
  mkPerson("Monica Kueche",15,5,{ts:0,coverage:false,kitchen:true,vac:25,qual:["Kitchen"]}),
  mkPerson("Monica Putzen",21,5,{ts:0,coverage:false,cleaning:true,vac:25,qual:["Cleaning"]}),
  mkPerson("Jimena",12,3,{ts:0,coverage:false,cleaning:true,vac:20,qual:["Cleaning"]}),
];
const DEFAULT_SETTINGS = {defaultMin:5, u3Default:10, over3Default:20, u3Ratio:4, over3Ratio:9};
// Snapshot data from Google Sheets export (KW25-KW27, captured 18.06.2026)
// Source: Dienstplan_2026.xlsx
const SNAPSHOT_KW25_27 = {
  shiftMap: {
    "Urlaub":"Vacation","Krank":"Sick","Krank KS":"Sick-K","Krank Kind KS":"Sick-K",
    "Frei":"Off","Frei/KS":"Off","Feiertag":"Holiday","FFU":"FFU",
    "A":"A","A+":"A+","B":"B","B+":"B+","C":"C","D":"D","E+":"E+","E-4":"E-4","L-8":"L-8",
    "Limpieza":"Limpieza","Cocina":"Cocina","Training":"Training"
  },
  weeks: {
    "2026-KW25": {
      dateRange: "16.06–20.06.2026",
      backupNote: "Snapshot from Google Sheets 18.06.2026",
      rows: [
        {name:"Michaella", Mon:"Off",  Tue:"B",          Wed:"C",         Thu:"Off",          Fri:"E+",        tueDelta:-1, wedDelta:-0.5, friDelta:-0.5},
        {name:"Ileana",    Mon:"E+",   Tue:"B",           Wed:"D",         Thu:"A+",           Fri:"Vacation",  monDelta:-0.5},
        {name:"Maria",     Mon:"A+",   Tue:"B",           Wed:"B+",        Thu:"E+",           Fri:"B+"},
        {name:"Emma",      Mon:"Off",  Tue:"C",           Wed:"A+",        Thu:"D",            Fri:"B"},
        {name:"Marcela",   Mon:"Sick-K",Tue:"Sick-K",     Wed:"Sick-K",    Thu:"Sick-K",       Fri:"Sick-K"},
        {name:"Fernando",  Mon:"Off",  Tue:"C",           Wed:"B",         Thu:"Sick-K",       Fri:"A+"},
        {name:"Ina",       Mon:"D",    Tue:"A+",          Wed:"Off",       Thu:"B+",           Fri:"C"},
        {name:"Springer 1",Mon:"B",    Tue:null,          Wed:null,        Thu:null,           Fri:null,        monDelta:-4},
        {name:"Springer 2",Mon:"B+",   Tue:"B+",          Wed:null,        Thu:null,           Fri:null},
        {name:"Springer 3",Mon:"B+",   Tue:null,          Wed:null,        Thu:"B",            Fri:null,        monDelta:-4},
        {name:"Monica Kueche", Mon:"Sick-K",Tue:"Sick-K", Wed:"Sick-K",    Thu:"Sick-K",       Fri:"Sick-K"},
        {name:"Monica Putzen", Mon:"Limpieza",Tue:"Limpieza",Wed:"Limpieza",Thu:"Limpieza",    Fri:"Limpieza"},
      ],
      dayNotes: {
        Mon: "Ana Paula 9-11 / Maria Jose B+  / Rocio 13-15",
        Tue: "Ela 9-14 / Maria Jose B+ / Supervision Til",
        Wed: "Ela ab 11-16:30 / Edurnis 9-15",
        Thu: "OP von (Amin) Fer / Rocio B / Elterncafe 15:30",
        Fri: null
      }
    },
    "2026-KW26": {
      dateRange: "22.06–27.06.2026",
      backupNote: "Snapshot from Google Sheets 18.06.2026",
      rows: [
        {name:"Michaella", Mon:"Off",  Tue:"B",    Wed:"B",   Thu:"Off",   Fri:"A+",    tueDelta:-1, wedDelta:-0.5},
        {name:"Ileana",    Mon:"D",    Tue:"A+",   Wed:"FFU", Thu:"A+",    Fri:"B",     wedDelta:-6},
        {name:"Maria",     Mon:"B+",   Tue:"B",    Wed:"A+",  Thu:"B+",    Fri:"C"},
        {name:"Emma",      Mon:"Off",  Tue:"C",    Wed:"B+",  Thu:"B",     Fri:"C"},
        {name:"Marcela",   Mon:"A+",   Tue:"B+",   Wed:"C",   Thu:"D",     Fri:"Off"},
        {name:"Fernando",  Mon:"B",    Tue:"C",    Wed:"D",   Thu:"Off",   Fri:"B"},
        {name:"Ina",       Mon:"Vacation",Tue:"Vacation",Wed:"Off",Thu:"Vacation",Fri:"Vacation"},
        {name:"Springer 2",Mon:"C",    Tue:null,   Wed:null,  Thu:"C",     Fri:null},
        {name:"Springer 3",Mon:null,   Tue:null,   Wed:null,  Thu:null,    Fri:"B+"},
        {name:"Monica Kueche", Mon:"Sick-K",Tue:"Sick-K",Wed:"Sick-K",Thu:"Sick-K",Fri:"Sick-K"},
        {name:"Monica Putzen", Mon:"Limpieza",Tue:"Limpieza",Wed:"Limpieza",Thu:"Limpieza",Fri:"Limpieza"},
      ],
      dayNotes: {
        Mon: "Maria Jose C",
        Tue: "PV Treffen 9:00 / Ela 9-14 (Vorschule)",
        Wed: "Ela 9-14:30 / Alba Sport",
        Thu: "Maria Jose c / Musik Lucio",
        Fri: "Ily HO / Ela 8-13:30 / Rocio"
      }
    },
    "2026-KW27": {
      dateRange: "29.06–03.07.2026",
      backupNote: "Snapshot from Google Sheets 18.06.2026",
      rows: [
        {name:"Michaella", Mon:null,   Tue:null,   Wed:null,  Thu:"Off",   Fri:"Off"},
        {name:"Ileana",    Mon:null,   Tue:null,   Wed:null,  Thu:null,    Fri:null},
        {name:"Maria",     Mon:null,   Tue:null,   Wed:null,  Thu:null,    Fri:null},
        {name:"Emma",      Mon:"Off",  Tue:null,   Wed:null,  Thu:null,    Fri:null},
        {name:"Marcela",   Mon:"Off",  Tue:null,   Wed:null,  Thu:null,    Fri:null},
        {name:"Fernando",  Mon:null,   Tue:null,   Wed:null,  Thu:null,    Fri:null},
        {name:"Ina",       Mon:null,   Tue:null,   Wed:"Off", Thu:null,    Fri:null},
        {name:"Monica Kueche", Mon:"Cocina",Tue:"Cocina",Wed:"Cocina",Thu:"Cocina",Fri:"Cocina"},
        {name:"Monica Putzen", Mon:"Limpieza",Tue:"Limpieza",Wed:"Limpieza",Thu:"Limpieza",Fri:"Limpieza"},
      ],
      dayNotes: {
        Mon:null, Tue:null, Wed:null, Thu:null, Fri:"26.5 Ela Urlaub"
      }
    }
  }
};


function genWeeks() {
  var out=[], start=new Date(2025,11,29);
  var fmt=function(d){return String(d.getDate()).padStart(2,"0")+"."+String(d.getMonth()+1).padStart(2,"0");};
  for(var i=0;i<53;i++){
    var mo=new Date(start); mo.setDate(start.getDate()+i*7);
    var fr=new Date(mo); fr.setDate(mo.getDate()+4);
    out.push({key:"2026-KW"+String(i+1).padStart(2,"0"),kw:"Week "+String(i+1).padStart(2,"0"),range:fmt(mo)+" – "+fmt(fr),mo:mo});
  }
  return out;
}
const WEEKS = genWeeks();
function currentWeekIndex(){
  var now=new Date();
  for(var i=0;i<WEEKS.length;i++){var a=WEEKS[i].mo,b=new Date(a);b.setDate(a.getDate()+7);if(now>=a&&now<b)return i;}
  return 24;
}
const DEFAULT_WEEK = WEEKS[currentWeekIndex()].key;

function isoToDisplay(iso){if(!iso)return"";var p=iso.split("-");return p[2]+"."+p[1]+"."+p[0];}
function isoWeekKey(iso){
  if(!iso)return null;
  var d=new Date(iso+"T12:00:00"),day=d.getDay();
  var mo=new Date(d);mo.setDate(d.getDate()-(day===0?6:day-1));
  var found=WEEKS.find(function(w){return w.mo.getFullYear()===mo.getFullYear()&&w.mo.getMonth()===mo.getMonth()&&w.mo.getDate()===mo.getDate();});
  return found?found.key:null;
}
function isoDayCode(iso){if(!iso)return null;var d=new Date(iso+"T12:00:00");return["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];}
function hoursFromTimes(s,e){if(!s||!e)return 0;var sh=s.split(":").map(Number),eh=e.split(":").map(Number);return Math.max(0,(eh[0]*60+eh[1]-sh[0]*60-sh[1])/60);}
function hToHMS(h){if(h==null)return"";var hh=Math.floor(h),mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");}
function hmsToH(t){if(!t)return null;var p=t.split(":");if(p.length<2)return null;return Number(p[0])+(Number(p[1])||0)/60;}
function todayISO(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function formatBerlin(isoString){
  if(!isoString)return null;
  try{
    var d=new Date(isoString);
    var opts={timeZone:"Europe/Berlin",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false};
    var parts=new Intl.DateTimeFormat("de-DE",opts).formatToParts(d);
    var map={};parts.forEach(function(p){map[p.type]=p.value;});
    return map.day+"."+map.month+"."+map.year+", "+map.hour+":"+map.minute;
  }catch(e){return isoString;}
}
function formatBerlinDateOnly(isoString){
  if(!isoString)return null;
  try{
    var d=new Date(isoString);
    var opts={timeZone:"Europe/Berlin",day:"2-digit",month:"2-digit",year:"numeric"};
    var parts=new Intl.DateTimeFormat("de-DE",opts).formatToParts(d);
    var map={};parts.forEach(function(p){map[p.type]=p.value;});
    return map.day+"."+map.month+"."+map.year;
  }catch(e){return isoString;}
}
var APP_BUILD_TIME=typeof __APP_BUILD_TIME__!=="undefined"?__APP_BUILD_TIME__:null;
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function round(n){return Math.round(n*100)/100;}

function shiftMap(shifts){var m={};shifts.forEach(function(s){m[s.code]=s;});return m;}
function weekData(s,k){return s.weeks[k]||{assign:{},notes:{},adj:{},minOverride:{},u3Override:{},over3Override:{},backupByDay:{},confirmed:false,published:false};}
function cellCode(s,k,pid,d){var w=s.weeks[k];return(w&&w.assign[pid]&&w.assign[pid][d])||"";}
function hasAssignInWeek(s,k,pid){var w=s.weeks[k];return!!(w&&w.assign[pid]&&DAYS.some(function(d){return w.assign[pid][d];}));}
function hasAnyData(s,pid){return WEEKS.some(function(w){return hasAssignInWeek(s,w.key,pid);});}
function dayMin(s,k,d){var w=s.weeks[k];var o=w&&w.minOverride&&w.minOverride[d];return(o===0||o)?o:s.settings.defaultMin;}
function availVal(p,d){var v=p.availability&&p.availability[d];if(v===true||v===undefined)return"full";if(v===false)return"off";return v;}
function parseRange(t){var m=t&&t.match(/(\d{2}):(\d{2})\D+(\d{2}):(\d{2})/);return m?{s:+m[1]*60+ +m[2],e:+m[3]*60+ +m[4]}:null;}
function availConflict(shift,av){if(av==="full")return false;if(av==="off")return true;var r=parseRange(shift.time);if(!r)return false;if(av==="am")return r.e>13*60;if(av==="pm")return r.s<13*60;return false;}
function absCodeForCell(absences,pid,wk,dayCode){var a=(absences||[]).filter(function(x){return x.pid===pid&&isoDayCode(x.date)===dayCode&&isoWeekKey(x.date)===wk;});return a.length?a[0].code:null;}

function personWeek(s,sm,k,p,tsLog){
  var wd=weekData(s,k);
  var days=DAYS.map(function(d){var ab=absCodeForCell(s.absences||[],p.id,k,d);return ab||cellCode(s,k,p.id,d);});
  var codes=days.map(function(c){return sm[c];}).filter(Boolean);
  // Add custom shift hours (override per cell)
  var customHours=DAYS.reduce(function(total,d){
    var cs=wd.customShifts&&wd.customShifts[p.id]&&wd.customShifts[p.id][d];
    if(cs&&cs.startTime!=null&&cs.endTime!=null) return total+(cs.endTime-cs.startTime);
    return total;
  },0);
  var worked=codes.filter(function(x){return x.work;}).reduce(function(a,x){return a+x.hours;},0)+customHours;
  var hasWork=codes.some(function(x){return x.work;})||customHours>0;
  var hpd=p.daysPerWeek>0?p.weeklyHours/p.daysPerWeek:0;
  var absenceDays=codes.filter(function(x){return x.vacation||x.sick||x.holiday;}).length;
  var adj=(wd.adj||{})[p.id]||0;
  var planned=worked+(hasWork?p.tsHours:0)+adj+absenceDays*hpd;
  var tsEntries=(tsLog||[]).filter(function(e){return e.pid===p.id&&isoWeekKey(e.date)===k;});
  var tsActual=tsEntries.reduce(function(a,e){return a+(e.hours||0);},0);
  var hasTs=tsEntries.length>0;
  var ist=hasTs?tsActual:planned;
  var delta=ist-p.weeklyHours;
  var divergence=hasTs&&Math.abs(tsActual-planned)>0.1;
  return{ist:ist,soll:p.weeklyHours,delta:delta,planned:planned,
    vacDays:days.filter(function(c){return sm[c]&&sm[c].vacation;}).length,
    sickDays:days.filter(function(c){return sm[c]&&sm[c].sick;}).length,
    hasAny:codes.length>0||adj!==0||hasTs,hasTs:hasTs,divergence:divergence};
}
function balances(s,sm){
  var tsLog=s.timesheetLog||[];
  return s.team.map(function(p){
    var vacTaken=0,sick=0,ot=p.startOvertime;
    WEEKS.forEach(function(w){var pw=personWeek(s,sm,w.key,p,tsLog);vacTaken+=pw.vacDays;sick+=pw.sickDays;if(weekData(s,w.key).confirmed&&pw.hasAny)ot+=pw.delta;});
    return Object.assign({},p,{vacTaken:vacTaken,sick:sick,overtime:ot,vacLeft:p.vacationAllowance-vacTaken});
  });
}
function dayCoverages(s,sm,k,d,min){
  var wd9=weekData(s,k);
  function working(pid){
    var cs=wd9.customShifts&&wd9.customShifts[pid]&&wd9.customShifts[pid][d];
    if(cs&&cs.startTime!=null)return true;
    var ab=absCodeForCell(s.absences||[],pid,k,d);var code=ab||cellCode(s,k,pid,d);var sh=sm[code];return sh&&sh.work;
  }
  // Pedagogical coverage = educators only (not eltern, not kitchen, not cleaning)
  var educators=s.team.filter(function(p){return p.coverage&&!p.kitchen&&!p.cleaning&&!p.eltern&&(p.active||hasAssignInWeek(s,k,p.id))&&working(p.id);});
  var elternPresent=s.team.filter(function(p){return p.eltern&&(p.active||hasAssignInWeek(s,k,p.id))&&working(p.id);});
  // Springers: available = active, not working, has hours remaining
  var freeSpringer=s.team.filter(function(p){
    if(!p.springer||!p.active||working(p.id))return false;
    var remaining=(p.springerHoursLimit||0)-(p.springerHoursUsed||0);
    return remaining>0||p.springerHoursLimit===0; // 0 limit = unlimited
  });
  var count=educators.length,gap=Math.max(0,min-count);
  var status="ok";if(gap>0)status="gap";else if(count===min)status="tight";
  var kitchenOk=s.team.some(function(p){return p.kitchen&&(p.active||hasAssignInWeek(s,k,p.id))&&working(p.id);});
  var cleaningOk=s.team.some(function(p){return p.cleaning&&(p.active||hasAssignInWeek(s,k,p.id))&&working(p.id);});
  // Parent-only: Elterndienst is working but zero educators present
  var parentOnly=elternPresent.length>0&&educators.length===0;
  // Springers actually scheduled (working) today
  var activeSpringer=s.team.filter(function(p){return p.springer&&(p.active||hasAssignInWeek(s,k,p.id))&&working(p.id);});
  return{count:count,gap:gap,status:status,freeSpringer:freeSpringer,activeSpringer:activeSpringer,min:min,
         kitchenOk:kitchenOk,cleaningOk:cleaningOk,
         elternCount:elternPresent.length,parentOnly:parentOnly};
}
function buildRecommendation(c,backupForDay,absentPids,teamById){
  var parts=[];
  if(c.gap>0){
    parts.push({type:"support",bold:c.gap,text:"Support needed",suffix:"people deficit"});
    // Always show backup line when support is needed
    var bu=backupForDay?teamById[backupForDay]:null;
    parts.push({type:"backup",text:bu?(bu.name+" as backup person"):"No backup person designated"});
    // Springers actually scheduled (working) today
    var activeSpr=c.activeSpringer?c.activeSpringer.length:0;
    parts.push({type:"springer",text:activeSpr+" springer"+(activeSpr===1?"":"s")+" already appointed"});
  }
  if(!c.kitchenOk)parts.push({type:"warn",text:"⚠ No kitchen coverage"});
  if(!c.cleaningOk)parts.push({type:"warn",text:"⚠ No cleaning coverage"});
  if(c.parentOnly)parts.push({type:"critical",text:"🚨 Critical: Elterndienst without educator"});
  return parts;
}

const GANTT_START=8,GANTT_END=17.5;
function buildDayGantt(s,sm,k,d){
  var slots=[];
  var wd=weekData(s,k);
  s.team.forEach(function(p){
    if(!(p.active||hasAssignInWeek(s,k,p.id)))return;
    var cs=wd.customShifts&&wd.customShifts[p.id]&&wd.customShifts[p.id][d];
    if(cs&&cs.startTime!=null&&cs.endTime!=null){
      slots.push({pid:p.id,name:p.name,start:cs.startTime,end:cs.endTime,code:"Custom",note:cs.note||"",kitchen:p.kitchen,cleaning:p.cleaning,eltern:p.eltern,springer:p.springer,isCustom:true});
      return;
    }
    var ab=absCodeForCell(s.absences||[],p.id,k,d);
    var code=ab||cellCode(s,k,p.id,d);
    var sh=sm[code];
    if(!sh||!sh.work||sh.start==null)return;
    slots.push({pid:p.id,name:p.name,start:sh.start,end:sh.end,code:code,kitchen:p.kitchen,cleaning:p.cleaning,eltern:p.eltern,springer:p.springer});
  });
  return slots;
}
function hourlyCoverage(slots){
  var buckets=[];
  for(var h=GANTT_START;h<GANTT_END;h+=0.5){
    var hh=h;
    var count=slots.filter(function(sl){return sl.start<=hh&&sl.end>hh&&!sl.kitchen&&!sl.cleaning;}).length;
    buckets.push({h:h,count:count});
  }
  return buckets;
}
function dayRequired(s,k,d){
  var st=s.settings||{};
  var wd=weekData(s,k);
  var u3=(wd.u3Override&&wd.u3Override[d]!=null)?wd.u3Override[d]:(st.u3Default||8);
  var u3p=(wd.over3Override&&wd.over3Override[d]!=null)?wd.over3Override[d]:(st.over3Default||20);
  var calc=Math.ceil(u3/(st.u3Ratio||4))+Math.ceil(u3p/(st.over3Ratio||9));
  var manual=wd.minOverride&&wd.minOverride[d];
  return{u3:u3,u3p:u3p,calc:calc,manualMin:manual,effective:(manual!=null)?manual:calc};
}

const hasStore=true;
function loadState(){
  return supabase.from("app_state").select("data,updated_at,version").eq("id","main").single().then(function(res){
    if(res.error)throw res.error;
    return {data:res.data?res.data.data:null,updatedAt:res.data?res.data.updated_at:null,version:res.data?res.data.version:null};
  });
}

/* ---- Change diff engine: turns (previous state -> next state) into activity_log events ---- */
function dayLabel(dc){var m={Mon:"Monday",Tue:"Tuesday",Wed:"Wednesday",Thu:"Thursday",Fri:"Friday"};return m[dc]||dc;}
function planDayDate(weekKey,dayCode){
  var weekInfo=WEEKS.find(function(w){return w.key===weekKey;});
  var dayIndex=DAYS.indexOf(dayCode);
  if(!weekInfo||dayIndex<0)return dayLabel(dayCode);
  var date=new Date(weekInfo.mo);date.setDate(weekInfo.mo.getDate()+dayIndex);
  return String(date.getDate()).padStart(2,"0")+"."+String(date.getMonth()+1).padStart(2,"0")+"."+date.getFullYear();
}
// Mirrors PostgreSQL jsonb equality more closely than raw JSON.stringify:
// object-key order is ignored, while array order remains significant.
function canonicalJsonValue(value){
  if(Array.isArray(value))return value.map(canonicalJsonValue);
  if(value&&typeof value==="object"){
    var out={};
    Object.keys(value).sort().forEach(function(key){
      if(value[key]!==undefined)out[key]=canonicalJsonValue(value[key]);
    });
    return out;
  }
  return value;
}
function jsonEqual(a,b){return JSON.stringify(canonicalJsonValue(a))===JSON.stringify(canonicalJsonValue(b));}
function buildChangeEvents(prev,next){
  var events=[];
  if(!prev)return events;

  // ---- weeks (section: plan) ----
  var wkKeys={}; Object.keys(prev.weeks||{}).forEach(function(k){wkKeys[k]=1;}); Object.keys(next.weeks||{}).forEach(function(k){wkKeys[k]=1;});
  Object.keys(wkKeys).forEach(function(wk){
    var pw=(prev.weeks||{})[wk]||{}, nw=(next.weeks||{})[wk]||{};
    if(pw===nw)return;
    var weekEventStart=events.length;
    var teamById={}; (next.team||prev.team||[]).forEach(function(p){teamById[p.id]=p.name;});

    // shift cell changes
    var pAssign=pw.assign||{}, nAssign=nw.assign||{};
    var pids={}; Object.keys(pAssign).forEach(function(k){pids[k]=1;}); Object.keys(nAssign).forEach(function(k){pids[k]=1;});
    Object.keys(pids).forEach(function(pid){
      var pd=pAssign[pid]||{}, nd=nAssign[pid]||{};
      var days={}; Object.keys(pd).forEach(function(k){days[k]=1;}); Object.keys(nd).forEach(function(k){days[k]=1;});
      Object.keys(days).forEach(function(d){
        if((pd[d]||null)!==(nd[d]||null)){
          events.push({section_id:"plan",action:"shift_changed",week_key:wk,person_id:pid,person_name:teamById[pid]||pid,day:d,before:pd[d]||null,after:nd[d]||null});
        }
      });
    });

    if(!jsonEqual(pw.customShifts||{},nw.customShifts||{})){
      events.push({section_id:"plan",action:"custom_shift_changed",week_key:wk,changed_paths:["customShifts"]});
    }
    if(!jsonEqual(pw.backupByDay||{},nw.backupByDay||{})){
      events.push({section_id:"plan",action:"backup_changed",week_key:wk,before:pw.backupByDay||{},after:nw.backupByDay||{}});
    }
    if(!jsonEqual(pw.notes||{},nw.notes||{})){
      events.push({section_id:"plan",action:"note_updated",week_key:wk,changed_paths:["notes"]});
    }
    if(!jsonEqual(pw.adj||{},nw.adj||{})){
      events.push({section_id:"plan",action:"adjustment_changed",week_key:wk,before:pw.adj||{},after:nw.adj||{}});
    }
    ["minOverride","u3Override","over3Override"].forEach(function(f){
      var pOverrides=pw[f]||{},nOverrides=nw[f]||{};
      var overrideDays={};
      Object.keys(pOverrides).forEach(function(d){overrideDays[d]=1;});
      Object.keys(nOverrides).forEach(function(d){overrideDays[d]=1;});
      Object.keys(overrideDays).forEach(function(d){
        var before=Object.prototype.hasOwnProperty.call(pOverrides,d)?pOverrides[d]:null;
        var after=Object.prototype.hasOwnProperty.call(nOverrides,d)?nOverrides[d]:null;
        if(!jsonEqual(before,after)){
          events.push({section_id:"plan",action:f+"_changed",week_key:wk,day:d,before:before,after:after});
        }
      });
    });
    if(!!pw.confirmed!==!!nw.confirmed){
      events.push({section_id:"plan",action:nw.confirmed?"week_confirmed":"week_unconfirmed",week_key:wk});
    }
    if(!!pw.published!==!!nw.published){
      events.push({section_id:"plan",action:nw.published?"week_published":"week_unpublished",week_key:wk});
    }
    // Generic safety net for any week field not covered above.
    // This prevents a real change from being treated as already persisted.
    if(!jsonEqual(pw,nw)&&events.length===weekEventStart){
      events.push({section_id:"plan",action:"week_updated",week_key:wk,changed_paths:["weeks."+wk]});
    }
  });

  // ---- absences (section: absences) ----
  var pAbs=prev.absences||[], nAbs=next.absences||[];
  if(!jsonEqual(pAbs,nAbs)){
    var pAbsById={}; pAbs.forEach(function(a){pAbsById[a.id]=a;});
    var nAbsById={}; nAbs.forEach(function(a){nAbsById[a.id]=a;});
    Object.keys(nAbsById).forEach(function(id){
      if(!pAbsById[id])events.push({section_id:"absences",action:"absence_created",absence_id:id,after:nAbsById[id]});
      else if(!jsonEqual(pAbsById[id],nAbsById[id]))events.push({section_id:"absences",action:"absence_edited",absence_id:id,before:pAbsById[id],after:nAbsById[id]});
    });
    Object.keys(pAbsById).forEach(function(id){
      if(!nAbsById[id])events.push({section_id:"absences",action:"absence_removed",absence_id:id,before:pAbsById[id]});
    });
    if(events.every(function(e){return e.section_id!=="absences";})){
      events.push({section_id:"absences",action:"absences_updated",changed_paths:["absences"]});
    }
  }

  // ---- timesheetLog (section: timesheet) ----
  var pTs=prev.timesheetLog||[], nTs=next.timesheetLog||[];
  if(!jsonEqual(pTs,nTs)){
    var pTsById={}; pTs.forEach(function(e){pTsById[e.id]=e;});
    var nTsById={}; nTs.forEach(function(e){nTsById[e.id]=e;});
    var tsEventAdded=false;
    Object.keys(nTsById).forEach(function(id){
      if(!pTsById[id]){events.push({section_id:"timesheet",action:"timesheet_added",entry_id:id,after:nTsById[id]});tsEventAdded=true;}
    });
    Object.keys(pTsById).forEach(function(id){
      if(!nTsById[id]){events.push({section_id:"timesheet",action:"timesheet_removed",entry_id:id,before:pTsById[id]});tsEventAdded=true;}
    });
    if(!tsEventAdded)events.push({section_id:"timesheet",action:"timesheet_updated",changed_paths:["timesheetLog"]});
  }

  // ---- team (section: balances if only .note changed, in the same order; else setup) ----
  var pTeam=prev.team||[], nTeam=next.team||[];
  if(!jsonEqual(pTeam,nTeam)){
    var sameOrderIds=pTeam.length===nTeam.length&&pTeam.every(function(p,i){return nTeam[i]&&nTeam[i].id===p.id;});
    var onlyNotesDiffer=sameOrderIds&&pTeam.every(function(p,i){
      var n=nTeam[i];
      var pCopy=Object.assign({},p); delete pCopy.note;
      var nCopy=Object.assign({},n); delete nCopy.note;
      return jsonEqual(pCopy,nCopy);
    });
    if(onlyNotesDiffer){
      pTeam.forEach(function(p,i){
        if(p.note!==nTeam[i].note)events.push({section_id:"balances",action:"note_updated",person_id:p.id,person_name:p.name,before:p.note||"",after:nTeam[i].note||""});
      });
    } else {
      events.push({section_id:"setup",action:"section_updated",changed_paths:["team"]});
    }
  }

  // ---- shifts / settings (section: setup, generic) ----
  if(!jsonEqual(prev.shifts||[],next.shifts||[])){
    events.push({section_id:"setup",action:"section_updated",changed_paths:["shifts"]});
  }
  if(!jsonEqual(prev.settings||{},next.settings||{})){
    events.push({section_id:"setup",action:"section_updated",changed_paths:["settings"]});
  }

  return events;
}

function saveAppStateRpc(newData,expectedVersion,events){
  return supabase.rpc("save_app_state",{p_new_data:newData,p_expected_version:expectedVersion,p_events:events}).then(function(res){
    if(res.error)throw res.error;
    return res.data;
  });
}

function buildBulkImportEvents(prev,next,sourceLabel){
  var events=[];
  if(!prev)return events;

  // Keep bulk imports compact, but still provide one matching event for every
  // section changed so the SQL permission checks remain valid.
  var pWeeks=prev.weeks||{}, nWeeks=next.weeks||{};
  var wkKeys={};
  Object.keys(pWeeks).forEach(function(k){wkKeys[k]=1;});
  Object.keys(nWeeks).forEach(function(k){wkKeys[k]=1;});
  Object.keys(wkKeys).forEach(function(wk){
    var pHas=Object.prototype.hasOwnProperty.call(pWeeks,wk);
    var nHas=Object.prototype.hasOwnProperty.call(nWeeks,wk);
    if(pHas!==nHas||!jsonEqual(pWeeks[wk]||{},nWeeks[wk]||{})){
      events.push({section_id:"plan",action:"bulk_import",source:sourceLabel,week_key:wk});
    }
  });

  if(!jsonEqual(prev.absences||[],next.absences||[])){
    events.push({section_id:"absences",action:"bulk_import",source:sourceLabel});
  }
  if(!jsonEqual(prev.timesheetLog||[],next.timesheetLog||[])){
    events.push({section_id:"timesheet",action:"bulk_import",source:sourceLabel});
  }

  var setupPaths=[];
  var pTeam=prev.team||[], nTeam=next.team||[];
  if(!jsonEqual(pTeam,nTeam)){
    var sameOrderIds=pTeam.length===nTeam.length&&pTeam.every(function(p,i){return nTeam[i]&&nTeam[i].id===p.id;});
    var onlyNotesDiffer=sameOrderIds&&pTeam.every(function(p,i){
      var n=nTeam[i];
      var pCopy=Object.assign({},p); delete pCopy.note;
      var nCopy=Object.assign({},n); delete nCopy.note;
      return jsonEqual(pCopy,nCopy);
    });
    if(onlyNotesDiffer){
      events.push({section_id:"balances",action:"bulk_import",source:sourceLabel});
    }else{
      setupPaths.push("team");
    }
  }
  if(!jsonEqual(prev.shifts||[],next.shifts||[]))setupPaths.push("shifts");
  if(!jsonEqual(prev.settings||{},next.settings||{}))setupPaths.push("settings");
  if(setupPaths.length){
    events.push({section_id:"setup",action:"bulk_import",source:sourceLabel,changed_paths:setupPaths});
  }

  return events;
}

function bulkImportRpc(previousData,newData,expectedVersion,sourceLabel){
  var events=buildBulkImportEvents(previousData,newData,sourceLabel);
  return saveAppStateRpc(newData,expectedVersion,events);
}

function validateImportedStatePayload(value){
  if(!value||typeof value!=="object"||Array.isArray(value)){
    return "Imported data must be a JSON object.";
  }
  var required=["team","shifts","weeks","settings","absences","timesheetLog"];
  var unknown=Object.keys(value).filter(function(key){return required.indexOf(key)<0;});
  if(unknown.length){
    return "Imported data contains unknown top-level keys: "+unknown.join(", ")+".";
  }
  var missing=required.filter(function(key){return !Object.prototype.hasOwnProperty.call(value,key);});
  if(missing.length){
    return "Imported data is missing required keys: "+missing.join(", ")+".";
  }
  if(!Array.isArray(value.team))return "Imported data.team must be an array.";
  if(!Array.isArray(value.shifts))return "Imported data.shifts must be an array.";
  if(!value.weeks||typeof value.weeks!=="object"||Array.isArray(value.weeks))return "Imported data.weeks must be an object.";
  if(!value.settings||typeof value.settings!=="object"||Array.isArray(value.settings))return "Imported data.settings must be an object.";
  if(!Array.isArray(value.absences))return "Imported data.absences must be an array.";
  if(!Array.isArray(value.timesheetLog))return "Imported data.timesheetLog must be an array.";
  return null;
}

function normalizeImportedStatePayload(value){
  return {
    team:value.team,
    shifts:value.shifts,
    weeks:value.weeks,
    settings:Object.assign({},DEFAULT_SETTINGS,value.settings),
    absences:value.absences,
    timesheetLog:value.timesheetLog
  };
}

/* ---- UI primitives ---- */
function Eyebrow(props){return React.createElement("div",{style:{fontSize:11,letterSpacing:".14em",textTransform:"uppercase",color:C.faint,fontWeight:600}},props.children);}
function StatusDot(props){var status=props.status,size=props.size||11;var colorMap={ok:C.ok,tight:C.tight,gap:C.gap};return React.createElement("span",{style:{display:"inline-block",width:size,height:size,borderRadius:size,background:colorMap[status]||C.faint}});}
function Pill(props){var m={ok:[C.okBg,C.ok],tight:[C.tightBg,C.tight],gap:[C.gapBg,C.gap],springer:[C.springerBg,C.springer],warn:[C.warnBg,C.warn],neutral:[C.lineSoft,C.muted]};var arr=m[props.tone]||m.neutral;return React.createElement("span",{style:{background:arr[0],color:arr[1],fontSize:12,fontWeight:600,padding:"2px 8px",borderRadius:999,whiteSpace:"nowrap"}},props.children);}
function Field(props){return React.createElement("label",{style:{display:"flex",flexDirection:"column",gap:5,fontSize:12,color:C.muted,fontWeight:600}},props.label,props.children);}
function SyncBadge(props){
  var status=props.status;
  var map={
    connecting:{color:C.faint,label:"Connecting..."},
    connected:{color:C.ok,label:"Connected"},
    saving:{color:C.tight,label:"Saving..."},
    saved:{color:C.ok,label:"Saved"},
    error:{color:C.gap,label:"Connection error"},
    conflict:{color:C.gap,label:"Conflict — reload needed"}
  };
  var m=map[status]||map.connecting;
  return React.createElement("span",{style:{display:"inline-flex",alignItems:"center",gap:6,marginLeft:10}},
    React.createElement("span",{style:{display:"inline-block",width:8,height:8,borderRadius:8,background:m.color,flexShrink:0}}),
    React.createElement("span",null,m.label)
  );
}

function LoginScreen(){
  var emailArr=useState(""); var email=emailArr[0],setEmail=emailArr[1];
  var pwArr=useState(""); var password=pwArr[0],setPassword=pwArr[1];
  var loadingArr=useState(null); var loadingType=loadingArr[0],setLoadingType=loadingArr[1];
  var msgArr=useState(null); var msg=msgArr[0],setMsg=msgArr[1];

  function handlePasswordSignIn(e){
    e.preventDefault();
    setMsg(null);
    if(!email||!password){setMsg({type:"error",text:"Please enter both email and password."});return;}
    setLoadingType("password");
    supabase.auth.signInWithPassword({email:email,password:password}).then(function(res){
      setLoadingType(null);
      if(res.error){setMsg({type:"error",text:"Invalid email or password."});return;}
      // success: onAuthStateChange in App() picks up the new session automatically
    }).catch(function(){
      setLoadingType(null);
      setMsg({type:"error",text:"Invalid email or password."});
    });
  }

  function handleMagicLink(e){
    e.preventDefault();
    setMsg(null);
    if(!email){setMsg({type:"error",text:"Please enter your email address first."});return;}
    setLoadingType("magiclink");
    supabase.auth.signInWithOtp({
      email:email,
      options:{shouldCreateUser:false,emailRedirectTo:window.location.origin}
    }).then(function(res){
      setLoadingType(null);
      if(res.error){
        console.warn("signInWithOtp error:",res.error);
        var status=res.error.status;
        if(status&&(status>=500||status===429)){
          setMsg({type:"error",text:"Could not send the login link right now. Please try again."});
          return;
        }
      }
      setMsg({type:"success",text:"If that email is registered, a sign-in link has been sent. Check your inbox."});
    }).catch(function(e){
      console.warn("signInWithOtp failed:",e);
      setLoadingType(null);
      setMsg({type:"error",text:"Could not send the login link right now. Please try again."});
    });
  }

  return React.createElement("div",{style:{fontFamily:FONT,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,padding:20}},
    React.createElement("div",{style:{width:"100%",maxWidth:380,background:C.surface,border:"1px solid "+C.line,borderRadius:14,padding:"28px 26px",boxShadow:"0 2px 10px rgba(0,0,0,.04)"}},
      React.createElement(Eyebrow,null,"Kita 30 Lobitos · parent initiative"),
      React.createElement("h1",{style:{margin:"4px 0 18px",fontSize:21,fontWeight:800,letterSpacing:"-.02em"}},"Sign in to Shift Plan"),
      React.createElement("form",{onSubmit:handlePasswordSignIn,style:{display:"flex",flexDirection:"column",gap:12}},
        React.createElement(Field,{label:"Email"},
          React.createElement("input",{type:"email",value:email,autoComplete:"email",onChange:function(e){setEmail(e.target.value);},style:txtInput})
        ),
        React.createElement(Field,{label:"Password"},
          React.createElement("input",{type:"password",value:password,autoComplete:"current-password",onChange:function(e){setPassword(e.target.value);},style:txtInput})
        ),
        React.createElement("button",{type:"submit",disabled:loadingType==="password",style:Object.assign({},btnStyle,{background:C.primary,color:"#fff",borderColor:C.primary,opacity:loadingType==="password"?0.6:1})},loadingType==="password"?"Signing in...":"Sign in")
      ),
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10,margin:"18px 0"}},
        React.createElement("div",{style:{flex:1,height:1,background:C.line}}),
        React.createElement("span",{style:{fontSize:12,color:C.faint}},"or"),
        React.createElement("div",{style:{flex:1,height:1,background:C.line}})
      ),
      React.createElement("button",{onClick:handleMagicLink,disabled:loadingType==="magiclink",style:Object.assign({},btnStyle,{width:"100%",opacity:loadingType==="magiclink"?0.6:1})},loadingType==="magiclink"?"Sending...":"Send magic link"),
      msg && React.createElement("div",{style:{marginTop:14,fontSize:13,color:msg.type==="error"?C.gap:C.ok}},msg.text)
    )
  );
}

const th={padding:"10px 8px",fontSize:12,fontWeight:700,color:C.muted,textAlign:"center",whiteSpace:"nowrap"};
const td={padding:"8px",textAlign:"center",verticalAlign:"middle"};
const selStyle={fontFamily:FONT,fontSize:14,padding:"8px 12px",borderRadius:9,border:"1px solid "+C.line,background:C.surface,color:C.ink,cursor:"pointer"};
const cellSel={fontFamily:FONT,fontSize:13,fontWeight:600,padding:"6px 4px",borderRadius:6,border:"1px solid "+C.line,background:"transparent",color:C.ink,width:"100%",cursor:"pointer",textAlign:"center"};
const btnStyle={fontFamily:FONT,fontSize:13.5,fontWeight:600,padding:"9px 16px",borderRadius:9,border:"1px solid "+C.line,background:C.surface,cursor:"pointer"};
const miniBtn={fontFamily:FONT,fontSize:12,fontWeight:600,padding:"4px 6px",border:"none",background:"none",cursor:"pointer"};
const linkBtn={background:"none",border:"none",cursor:"pointer",fontFamily:FONT,color:C.ink,padding:0,textAlign:"left"};
const numInput={fontFamily:FONT,width:56,fontSize:13,padding:"5px 6px",borderRadius:6,border:"1px solid "+C.line,textAlign:"center",boxSizing:"border-box"};
const txtInput={fontFamily:FONT,fontSize:13,padding:"5px 8px",borderRadius:6,border:"1px solid "+C.line,boxSizing:"border-box"};
const emptyBox={background:C.surface,border:"1px dashed "+C.line,borderRadius:12,padding:"28px 20px",color:C.muted,textAlign:"center",fontSize:14};

const ALL_SECTIONS=[["plan","Weekly plan"],["forecast","Coverage"],["absences","Absences"],["balances","Leave & Time Balance"],["timesheet","Timesheet"],["next8","Next 8 weeks"],["setup","Team & Shifts"],["admin","Admin"],["dev","Dev"]];

export default function App(){
  var s0={team:DEFAULT_TEAM,shifts:DEFAULT_SHIFTS,weeks:{},settings:DEFAULT_SETTINGS,absences:[],timesheetLog:[]};
  var stateArr=useState(s0); var state=stateArr[0],setState=stateArr[1];
  var loadedArr=useState(false); var loaded=loadedArr[0],setLoaded=loadedArr[1];
  var syncArr=useState("connecting"); var syncStatus=syncArr[0],setSyncStatus=syncArr[1];
  var lduArr=useState(null); var lastDataUpdate=lduArr[0],setLastDataUpdate=lduArr[1];
  var undoArr=useState([]); var undoStack=undoArr[0],setUndoStack=undoArr[1];
  var redoArr=useState([]); var redoStack=redoArr[0],setRedoStack=redoArr[1];
  // Absences undo/redo — separate from Weekly Plan history
  var absUndoArr=useState([]); var absUndoStack=absUndoArr[0],setAbsUndoStack=absUndoArr[1];
  var absRedoArr=useState([]); var absRedoStack=absRedoArr[0],setAbsRedoStack=absRedoArr[1];
  var tabArr=useState("plan"); var tab=tabArr[0],setTab=tabArr[1];
  var weekArr=useState(DEFAULT_WEEK); var week=weekArr[0],setWeek=weekArr[1];
  var vpArr=useState(""); var viewerPid=vpArr[0],setViewerPid=vpArr[1];
  var previewRoleArr=useState("dev"); var previewRole=previewRoleArr[0],setPreviewRole=previewRoleArr[1];
  var rolePermsArr=useState(null); var rolePerms=rolePermsArr[0],setRolePerms=rolePermsArr[1];

  var APP_STATE_ROLES=["dev","admin","dienstplan","leitung","ed_team"];

  var sessionArr=useState(null); var session=sessionArr[0],setSession=sessionArr[1];
  var authLoadingArr=useState(true); var authLoading=authLoadingArr[0],setAuthLoading=authLoadingArr[1];
  var remoteLoadedArr=useState(false); var remoteLoadedSuccessfully=remoteLoadedArr[0],setRemoteLoadedSuccessfully=remoteLoadedArr[1];
  var skipNextSaveRef=useRef(true);
  var userId=session&&session.user?session.user.id:null;

  // profile: undefined = still checking, null = no active profile found, object = valid profile
  var profileArr=useState(undefined); var profile=profileArr[0],setProfile=profileArr[1];
  var profileErrorArr=useState(false); var profileError=profileErrorArr[0],setProfileError=profileErrorArr[1];
  var profileFetchIdRef=useRef(0);
  var profileCanAccessApp=!!(profile&&profile.active&&APP_STATE_ROLES.indexOf(profile.role_id)>=0);

  useEffect(function(){
    var mounted=true;
    supabase.auth.getSession().then(function(res){
      if(!mounted)return;
      setSession(res.data?res.data.session:null);
      setAuthLoading(false);
    }).catch(function(e){
      console.warn("getSession failed:",e);
      if(!mounted)return;
      setSession(null);
      setAuthLoading(false);
    });
    var listener=supabase.auth.onAuthStateChange(function(event,newSession){
      setSession(newSession);
      if(!newSession){
        setLoaded(false);
        setRemoteLoadedSuccessfully(false);
        setSyncStatus("connecting");
        skipNextSaveRef.current=true;
      }
    });
    return function(){mounted=false;listener.data.subscription.unsubscribe();};
  },[]);

  // profiles.email is informational only — never used for authorization. If a user's
  // email is later changed in Supabase Auth, this stored copy does NOT update on its own;
  // for now it would need a manual SQL correction (profiles.email is locked against UPDATE).
  useEffect(function(){
    var fetchId=++profileFetchIdRef.current;
    setProfile(undefined);
    setProfileError(false);
    setLoaded(false);
    setRemoteLoadedSuccessfully(false);
    skipNextSaveRef.current=true;
    if(!userId)return;
    supabase.from("profiles").select("*").eq("user_id",userId).maybeSingle().then(function(res){
      if(fetchId!==profileFetchIdRef.current)return; // a newer request has since started; ignore this stale one
      if(res.error){
        console.warn("profile fetch failed:",res.error);
        setProfileError(true);
        setProfile(null);
        return;
      }
      if(!res.data||!res.data.active){setProfile(null);return;}
      setProfile(res.data);
    }).catch(function(e){
      if(fetchId!==profileFetchIdRef.current)return;
      console.warn("profile fetch failed:",e);
      setProfileError(true);
      setProfile(null);
    });
  },[userId]);

  useEffect(function(){
    if(!userId){setRolePerms(null);return;}
    supabase.from("role_permissions").select("role_id,section_id,can_view,can_edit").then(function(res){
      if(res.error){console.warn("role_permissions fetch failed:",res.error);setRolePerms(null);return;}
      var map={};
      (res.data||[]).forEach(function(row){
        if(!map[row.role_id])map[row.role_id]={};
        map[row.role_id][row.section_id]={can_view:row.can_view,can_edit:row.can_edit};
      });
      setRolePerms(map);
    }).catch(function(e){console.warn("role_permissions fetch failed:",e);setRolePerms(null);});
  },[userId]);

  var stateRef=useRef(state); stateRef.current=state;
  var lastPersistedRef=useRef(null);
  var expectedVersionRef=useRef(null);
  var savingInFlightRef=useRef(false);
  var pendingRef=useRef(false);
  var nextSaveIsBulkRef=useRef(null);
  function markNextSaveBulk(sourceLabel){nextSaveIsBulkRef.current=sourceLabel;}

  function runSaveCycle(){
    if(savingInFlightRef.current)return;
    var snapshot=stateRef.current;
    if(snapshot===lastPersistedRef.current)return;
    var bulkSource=nextSaveIsBulkRef.current;
    var events=null;
    if(!bulkSource){
      events=buildChangeEvents(lastPersistedRef.current,snapshot);
    }
    nextSaveIsBulkRef.current=null;
    savingInFlightRef.current=true;
    setSyncStatus("saving");
    var call=bulkSource
      ? bulkImportRpc(lastPersistedRef.current,snapshot,expectedVersionRef.current,bulkSource)
      : saveAppStateRpc(snapshot,expectedVersionRef.current,events);
    call.then(function(res){
      savingInFlightRef.current=false;
      lastPersistedRef.current=snapshot;
      expectedVersionRef.current=res.version;
      if(res.updated_at)setLastDataUpdate(res.updated_at);
      setSyncStatus("saved");
      if(pendingRef.current){
        pendingRef.current=false;
        runSaveCycle();
      }
    }).catch(function(e){
      savingInFlightRef.current=false;
      console.warn("save_app_state failed:",e);
      var msg=(e&&e.message)||"";
      if(msg.indexOf("version_conflict")>=0){
        setSyncStatus("conflict");
      } else {
        setSyncStatus("error");
      }
      // Preserve a failed bulk import marker so a later retry does not expand
      // the same import into hundreds of granular events.
      if(bulkSource&&!nextSaveIsBulkRef.current)nextSaveIsBulkRef.current=bulkSource;
      // Deliberately NOT updating lastPersistedRef/expectedVersionRef on failure,
      // and NOT retrying automatically — no silent fallback, ever.
    });
  }

  useEffect(function(){
    if(!userId||!profileCanAccessApp)return;
    setSyncStatus("connecting");
    loadState().then(function(res){
      var s=res.data;
      if(!s||typeof s!=="object"||!s.team||!s.weeks||!s.shifts||!s.settings){
        throw new Error("Invalid or empty app_state data");
      }
      skipNextSaveRef.current=true;
      // Compute the loaded baseline synchronously before updating React state.
      // A value assigned inside a functional state updater is not guaranteed to
      // exist immediately; that race could leave lastPersistedRef as null and
      // make the first real edit produce no audit events.
      var merged=Object.assign({},s0,s,{settings:Object.assign({},DEFAULT_SETTINGS,s.settings||{}),absences:s.absences||[],timesheetLog:s.timesheetLog||[]});
      lastPersistedRef.current=merged;
      expectedVersionRef.current=res.version;
      if(res.updatedAt)setLastDataUpdate(res.updatedAt);
      setRemoteLoadedSuccessfully(true);
      setLoaded(true);
      setSyncStatus("connected");
      setState(merged);
    }).catch(function(e){
      console.warn("loadState failed:",e);
      setLoaded(true);
      setRemoteLoadedSuccessfully(false);
      setSyncStatus("error");
    });
  },[userId,profileCanAccessApp]);
  useEffect(function(){
    if(!userId||!profileCanAccessApp||!remoteLoadedSuccessfully)return;
    if(skipNextSaveRef.current){
      skipNextSaveRef.current=false;
      return;
    }
    if(savingInFlightRef.current){
      pendingRef.current=true;
      return;
    }
    runSaveCycle();
  },[state,userId,profileCanAccessApp,remoteLoadedSuccessfully]);
  useEffect(function(){if(!viewerPid&&state.team.length){var p=state.team.find(function(x){return x.active;});if(p)setViewerPid(p.id);}},[state.team]);

  var isDevUser=!!(profile&&profile.role_id==="dev");
  var effectiveRoleId=isDevUser?previewRole:(profile?profile.role_id:null);
  function sectionPerm(sectionId){
    if(!rolePerms||!effectiveRoleId)return {can_view:false,can_edit:false};
    var r=rolePerms[effectiveRoleId];
    if(!r||!r[sectionId])return {can_view:false,can_edit:false};
    return r[sectionId];
  }
  var tabs=ALL_SECTIONS.filter(function(s){return sectionPerm(s[0]).can_view;});
  useEffect(function(){if(tabs.length&&!tabs.some(function(t){return t[0]===tab;}))setTab(tabs[0][0]);},[effectiveRoleId,rolePerms]);

  var sm=useMemo(function(){return shiftMap(state.shifts);},[state.shifts]);
  var update=useCallback(function(fn){setState(function(prev){return fn(JSON.parse(JSON.stringify(prev)));});},[]);

  if(authLoading){
    return React.createElement("div",{style:{fontFamily:FONT,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:C.muted}},"Loading...");
  }
  if(!session){
    return React.createElement(LoginScreen,null);
  }
  if(profile===undefined){
    return React.createElement("div",{style:{fontFamily:FONT,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:C.muted}},"Checking access...");
  }
  if(profileError){
    return React.createElement("div",{style:{fontFamily:FONT,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:C.gap,gap:14}},
      React.createElement("div",null,"Could not check access."),
      React.createElement("div",{style:{display:"flex",gap:10}},
        React.createElement("button",{onClick:function(){window.location.reload();},style:btnStyle},"Retry"),
        React.createElement("button",{onClick:function(){supabase.auth.signOut();},style:btnStyle},"Sign out")
      )
    );
  }
  if(profile===null){
    return React.createElement("div",{style:{fontFamily:FONT,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:C.muted,gap:14}},
      React.createElement("div",null,"Access pending — contact your administrator."),
      React.createElement("button",{onClick:function(){supabase.auth.signOut();},style:btnStyle},"Sign out")
    );
  }
  if(!profileCanAccessApp){
    return React.createElement("div",{style:{fontFamily:FONT,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:C.muted,gap:14}},
      React.createElement("div",null,"Team access is not available yet."),
      React.createElement("button",{onClick:function(){supabase.auth.signOut();},style:btnStyle},"Sign out")
    );
  }
  if(!rolePerms){
    return React.createElement("div",{style:{fontFamily:FONT,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:C.muted}},"Loading permissions...");
  }
  if(!remoteLoadedSuccessfully&&syncStatus==="error"){
    return React.createElement("div",{style:{fontFamily:FONT,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:C.gap,gap:12}},
      React.createElement("div",null,"Connection error — could not load data from Supabase."),
      React.createElement("button",{onClick:function(){window.location.reload();},style:btnStyle},"Retry")
    );
  }
  if(!remoteLoadedSuccessfully){
    return React.createElement("div",{style:{fontFamily:FONT,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:C.muted}},"Loading data...");
  }
  // absUpdate: like update but snapshots state.absences before changing
  function absUpdate(fn){
    setState(function(prev){
      var snap=JSON.parse(JSON.stringify(prev.absences||[]));
      var next=fn(JSON.parse(JSON.stringify(prev)));
      setAbsUndoStack(function(u){var arr=u.concat([snap]);return arr.length>20?arr.slice(arr.length-20):arr;});
      setAbsRedoStack([]);
      return next;
    });
  }
  function absUndo(){
    setAbsUndoStack(function(u){
      if(!u.length)return u;
      var snap=u[u.length-1];
      var rest=u.slice(0,u.length-1);
      setState(function(prev){
        var cur=JSON.parse(JSON.stringify(prev.absences||[]));
        setAbsRedoStack(function(r){return r.concat([cur]);});
        return Object.assign({},prev,{absences:snap});
      });
      return rest;
    });
  }
  function absRedo(){
    setAbsRedoStack(function(r){
      if(!r.length)return r;
      var snap=r[r.length-1];
      var rest=r.slice(0,r.length-1);
      setState(function(prev){
        var cur=JSON.parse(JSON.stringify(prev.absences||[]));
        setAbsUndoStack(function(u){return u.concat([cur]);});
        return Object.assign({},prev,{absences:snap});
      });
      return rest;
    });
  }
  // planUpdate: like update but saves undo snapshot of current week before changing
  function planUpdate(weekKey, fn){
    setState(function(prev){
      var snap=prev.weeks[weekKey]?JSON.parse(JSON.stringify(prev.weeks[weekKey])):null;
      var next=fn(JSON.parse(JSON.stringify(prev)));
      // push snap to undo stack (limit 20)
      setUndoStack(function(u){var arr=u.concat([{weekKey:weekKey,snap:snap}]);return arr.length>20?arr.slice(arr.length-20):arr;});
      setRedoStack([]);
      return next;
    });
  }
  function planUndo(){
    setUndoStack(function(u){
      if(!u.length)return u;
      var entry=u[u.length-1];
      var rest=u.slice(0,u.length-1);
      setState(function(prev){
        var snap=prev.weeks[entry.weekKey]?JSON.parse(JSON.stringify(prev.weeks[entry.weekKey])):null;
        setRedoStack(function(r){return r.concat([{weekKey:entry.weekKey,snap:snap}]);});
        var next=JSON.parse(JSON.stringify(prev));
        if(entry.snap) next.weeks[entry.weekKey]=entry.snap;
        else delete next.weeks[entry.weekKey];
        return next;
      });
      return rest;
    });
  }
  function planRedo(){
    setRedoStack(function(r){
      if(!r.length)return r;
      var entry=r[r.length-1];
      var rest=r.slice(0,r.length-1);
      setState(function(prev){
        var snap=prev.weeks[entry.weekKey]?JSON.parse(JSON.stringify(prev.weeks[entry.weekKey])):null;
        setUndoStack(function(u){return u.concat([{weekKey:entry.weekKey,snap:snap}]);});
        var next=JSON.parse(JSON.stringify(prev));
        if(entry.snap) next.weeks[entry.weekKey]=entry.snap;
        else delete next.weeks[entry.weekKey];
        return next;
      });
      return rest;
    });
  }

  function ensureWeek(s){
    if(!s.weeks[week]){
      var newW={assign:{},notes:{},adj:{},minOverride:{},u3Override:{},over3Override:{},backupByDay:{},customShifts:{},confirmed:false,published:false};
      // Pre-fill Off for team members whose availability for that day = "off"
      s.team.forEach(function(p){
        if(!p.active)return;
        DAYS.forEach(function(d){
          var av=p.availability&&p.availability[d];
          if(av==="off"){
            if(!newW.assign[p.id])newW.assign[p.id]={};
            newW.assign[p.id][d]="Off";
          }
        });
      });
      s.weeks[week]=newW;
    }
    return s.weeks[week];
  }
  function setCell(pid,day,code){planUpdate(week,function(s){var w=ensureWeek(s);if(!w.assign[pid])w.assign[pid]={};if(code)w.assign[pid][day]=code;else delete w.assign[pid][day];return s;});}
  function setNote(pid,val){planUpdate(week,function(s){var w=ensureWeek(s);if(!w.notes)w.notes={};w.notes[pid]=val;return s;});}
  function setAdj(pid,val){planUpdate(week,function(s){var w=ensureWeek(s);if(!w.adj)w.adj={};w.adj[pid]=Number(val)||0;return s;});}
  function setMinOverride(day,val){planUpdate(week,function(s){var w=ensureWeek(s);if(!w.minOverride)w.minOverride={};w.minOverride[day]=val===""?undefined:Number(val);return s;});}
  function setU3Ov(day,val){planUpdate(week,function(s){var w=ensureWeek(s);if(!w.u3Override)w.u3Override={};w.u3Override[day]=Number(val);return s;});}
  function setOver3Ov(day,val){planUpdate(week,function(s){var w=ensureWeek(s);if(!w.over3Override)w.over3Override={};w.over3Override[day]=Number(val);return s;});}
  function setBackupWeek(day,pid){planUpdate(week,function(s){var w=ensureWeek(s);if(!w.backupByDay)w.backupByDay={};w.backupByDay[day]=pid;return s;});}
  function setCustomShift(pid,day,val){planUpdate(week,function(s){var w=ensureWeek(s);if(!w.customShifts)w.customShifts={};if(!w.customShifts[pid])w.customShifts[pid]={};if(val)w.customShifts[pid][day]=val;else delete w.customShifts[pid][day];return s;});}
  function toggleWeek(field){update(function(s){var w=ensureWeek(s);w[field]=!w[field];return s;});}

  var wkIdx=WEEKS.findIndex(function(w){return w.key===week;});
  if(wkIdx<0)wkIdx=0;
  var prevWeek=function(){if(wkIdx>0)setWeek(WEEKS[wkIdx-1].key);};
  var nextWeek=function(){if(wkIdx<WEEKS.length-1)setWeek(WEEKS[wkIdx+1].key);};

  if(!loaded)return React.createElement("div",{style:{fontFamily:FONT,background:C.bg,minHeight:"100vh",display:"grid",placeItems:"center",color:C.muted}},"Loading…");

  var wdata=weekData(state,week);
  return React.createElement("div",{style:{fontFamily:FONT,background:C.bg,minHeight:"100vh",color:C.ink}},
    React.createElement("header",{style:{borderBottom:"1px solid "+C.line,background:C.surface}},
      React.createElement("div",{style:{maxWidth:1200,margin:"0 auto",padding:"16px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}},
        React.createElement("div",null,
          React.createElement(Eyebrow,null,"Kita 30 Lobitos · parent initiative"),
          React.createElement("h1",{style:{margin:"2px 0 0",fontSize:25,fontWeight:800,letterSpacing:"-.02em"}},"Shift Plan")
        ),
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}},
          effectiveRoleId==="team" && React.createElement(Field,{label:"You are"},
            React.createElement("select",{value:viewerPid,onChange:function(e){setViewerPid(e.target.value);},style:Object.assign({},selStyle,{padding:"5px 8px",fontSize:12.5})},
              state.team.filter(function(p){return p.active;}).map(function(p){return React.createElement("option",{key:p.id,value:p.id},p.name);})
            )
          ),
          isDevUser && React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,fontSize:12.5,color:C.muted}},
            React.createElement("span",null,"Preview as"),
            React.createElement("select",{value:previewRole,onChange:function(e){setPreviewRole(e.target.value);},style:Object.assign({},selStyle,{padding:"5px 8px",fontSize:12.5})},
              [["dev","Dev"],["admin","Admin"],["dienstplan","Dienstplan"],["leitung","Leitung"],["ed_team","ED Team"],["team","Team"]].map(function(o){return React.createElement("option",{key:o[0],value:o[0]},o[1]);})
            )
          ),
          React.createElement("select",{disabled:true,style:Object.assign({},selStyle,{padding:"5px 8px",fontSize:12.5})},
            React.createElement("option",null,"EN"),React.createElement("option",null,"DE — soon")
          ),
          React.createElement("span",{style:{fontSize:12,color:C.faint}},session.user.email+(profile&&profile.role_id?" · "+profile.role_id:"")),
          React.createElement("button",{onClick:function(){supabase.auth.signOut();},style:Object.assign({},btnStyle,{padding:"6px 12px",fontSize:12.5})},"Sign out")
        )
      ),
      React.createElement("div",{style:{maxWidth:1200,margin:"0 auto",padding:"0 24px 12px"}},
        React.createElement("nav",{style:{display:"flex",gap:4,background:C.bg,padding:4,borderRadius:10,width:"fit-content",flexWrap:"wrap"}},
          tabs.map(function(kl){return React.createElement("button",{key:kl[0],onClick:function(){setTab(kl[0]);},style:{border:"none",cursor:"pointer",borderRadius:7,padding:"8px 14px",fontSize:13.5,fontWeight:600,fontFamily:FONT,background:tab===kl[0]?C.surface:"transparent",color:tab===kl[0]?C.primaryDark:C.muted,boxShadow:tab===kl[0]?"0 1px 2px rgba(0,0,0,.08)":"none"}},kl[1]);})
        )
      ),
      isDevUser&&previewRole!=="dev"&&React.createElement("div",{style:{background:C.tightBg,color:C.tight,fontSize:12.5,fontWeight:700,textAlign:"center",padding:"6px 12px"}},"Preview mode: "+previewRole),
      syncStatus==="conflict"&&React.createElement("div",{style:{background:C.gapBg,color:C.gap,fontSize:12.5,fontWeight:700,textAlign:"center",padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"center",gap:10}},
        React.createElement("span",null,"Someone else saved changes since you loaded this page. Reload before continuing, to avoid overwriting their work."),
        React.createElement("button",{onClick:function(){window.location.reload();},style:Object.assign({},btnStyle,{padding:"4px 10px",fontSize:12})},"Reload")
      ),
      syncStatus==="error"&&remoteLoadedSuccessfully&&React.createElement("div",{style:{background:C.tightBg,color:C.tight,fontSize:12.5,fontWeight:700,textAlign:"center",padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"center",gap:10}},
        React.createElement("span",null,"The last save failed. Your changes are still open in this tab and have not been marked as saved."),
        React.createElement("button",{onClick:runSaveCycle,style:Object.assign({},btnStyle,{padding:"4px 10px",fontSize:12})},"Retry save")
      )
    ),
    React.createElement("main",{style:{maxWidth:1200,margin:"0 auto",padding:"22px 24px"}},
      tab==="plan"      && React.createElement(PlanView,{state:state,sm:sm,week:week,setWeek:setWeek,wkIdx:wkIdx,prevWeek:prevWeek,nextWeek:nextWeek,editable:sectionPerm("plan").can_edit,setCell:setCell,setNote:setNote,setAdj:setAdj,setMinOverride:setMinOverride,setU3Ov:setU3Ov,setOver3Ov:setOver3Ov,setBackupWeek:setBackupWeek,setCustomShift:setCustomShift,toggleWeek:toggleWeek,planUndo:planUndo,planRedo:planRedo,undoStack:undoStack,redoStack:redoStack}),
      tab==="forecast"  && React.createElement(ForecastView,{state:state,sm:sm,setWeek:setWeek,setTab:setTab}),
      tab==="absences"  && React.createElement(AbsencesView,{state:state,sm:sm,update:absUpdate,editable:sectionPerm("absences").can_edit,viewerPid:viewerPid,absUndo:absUndo,absRedo:absRedo,absUndoStack:absUndoStack,absRedoStack:absRedoStack}),
      tab==="balances"  && React.createElement(BalancesView,{state:state,sm:sm,update:update,editable:sectionPerm("balances").can_edit}),
      tab==="timesheet" && React.createElement(TimesheetView,{state:state,sm:sm,update:update,editable:sectionPerm("timesheet").can_edit,viewerPid:viewerPid}),
      tab==="next8"     && React.createElement(Next8View,{state:state,sm:sm,viewerPid:viewerPid,editable:sectionPerm("next8").can_edit}),
      tab==="setup"     && React.createElement(SetupView,{state:state,update:update,editable:sectionPerm("setup").can_edit,setState:setState,markNextSaveBulk:markNextSaveBulk,effectiveRoleId:effectiveRoleId}),
      tab==="admin"     && React.createElement(AdminView,{state:state,effectiveRoleId:effectiveRoleId,userId:userId}),
      tab==="dev"       && React.createElement(DevView,{onPermsChange:function(roleId,sectionId,payload){
        setRolePerms(function(prev){
          var next=Object.assign({},prev);
          next[roleId]=Object.assign({},next[roleId]||{});
          next[roleId][sectionId]={can_view:payload.can_view,can_edit:payload.can_edit};
          return next;
        });
      }})
    ),
    React.createElement("footer",{style:{maxWidth:1200,margin:"0 auto",padding:"8px 24px 40px",color:C.faint,fontSize:12,display:"flex",alignItems:"center",flexWrap:"wrap",gap:"4px 10px"}},
      React.createElement("span",null,"Developed by Natan Magalhães"),
      APP_BUILD_TIME&&React.createElement("span",null,"· App updated: "+formatBerlinDateOnly(APP_BUILD_TIME)),
      lastDataUpdate&&React.createElement("span",null,"· Data updated: "+formatBerlin(lastDataUpdate)),
      React.createElement("span",{style:{display:"inline-flex",alignItems:"center"}},"· ",React.createElement(SyncBadge,{status:syncStatus}))
    )
  );
}

/* ================================================================== */
function HourlyCoverageBar(props){
  var slots=props.slots,min=props.min;
  var buckets=hourlyCoverage(slots);
  var TOTAL=GANTT_END-GANTT_START;
  function hFmt(h){var hh=Math.floor(h);var mm=h%1===0.5?"30":"00";return String(hh).padStart(2,"0")+":"+mm;}
  var pedSlots=slots.filter(function(sl){return !sl.kitchen&&!sl.cleaning&&sl.start!=null;});
  return React.createElement("div",{style:{marginTop:8}},
    React.createElement("div",{style:{display:"flex",justifyContent:"space-between",fontSize:9.5,color:C.faint,marginBottom:2,userSelect:"none"}},
      [8,9,10,11,12,13,14,15,16,17].map(function(h){return React.createElement("span",{key:h},String(h).padStart(2,"0")+"h");})
    ),
    React.createElement("div",{style:{position:"relative",height:Math.max(16,pedSlots.length*14)+4,marginBottom:3}},
      React.createElement("div",{style:{position:"absolute",top:0,left:0,right:0,bottom:0,background:C.lineSoft,borderRadius:4}}),
      pedSlots.map(function(sl,i){
        var left=((sl.start-GANTT_START)/TOTAL)*100;
        var width=((sl.end-sl.start)/TOTAL)*100;
        var color=sl.eltern?C.eltern:sl.springer?C.springer:C.primary;
        var firstName=sl.name?sl.name.split(" ")[0]:"?";
        var barH=12;
        var topPx=i*14+2;
        return React.createElement("div",{key:sl.pid||i,
          title:sl.name+": "+hFmt(sl.start)+"-"+hFmt(sl.end),
          style:{position:"absolute",top:topPx,height:barH,left:left+"%",width:width+"%",
            background:color,borderRadius:2,overflow:"hidden",display:"flex",alignItems:"center",
            paddingLeft:3,boxSizing:"border-box"}},
          React.createElement("span",{style:{fontSize:9,color:"#fff",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},firstName)
        );
      })
    ),

    React.createElement("div",{style:{display:"flex",gap:1,height:16,alignItems:"flex-end",borderRadius:4,overflow:"hidden"}},
      buckets.map(function(b,i){
        var bg=b.count===0?"#F6E1DE":b.count<min?"#F8F0D9":C.okBg;
        var border=b.count===0?C.gap:b.count<min?C.tight:C.ok;
        return React.createElement("div",{key:i,title:hFmt(b.h)+": "+b.count+" staff",style:{flex:1,background:bg,border:"1px solid "+border+"20",borderRadius:2,display:"flex",alignItems:"flex-end",justifyContent:"center",fontSize:8,color:b.count===0?C.gap:b.count<min?C.tight:C.ok,fontWeight:700,paddingBottom:1,minHeight:10,maxHeight:16,height:Math.max(35,(min>0?Math.min(b.count/min,1):1)*100)+"%"}},b.count||"");
      })
    ),

  );
}

/* ================================================================== */
function HistoryPanel(props){
  var weekKey=props.weekKey;
  var itemsArr=useState(null); var items=itemsArr[0],setItems=itemsArr[1];
  var errArr=useState(null); var err=errArr[0],setErr=errArr[1];
  var limitArr=useState(50); var limit=limitArr[0],setLimit=limitArr[1];

  function reload(lim){
    setErr(null);
    supabase.from("activity_log").select("*").eq("section_id","plan").eq("details->>week_key",weekKey)
      .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(lim||limit)
      .then(function(res){
        if(res.error){console.warn("activity_log load failed:",res.error);setErr("Could not load history.");return;}
        setItems(res.data||[]);
      }).catch(function(e){console.warn("activity_log load failed:",e);setErr("Could not load history.");});
  }
  useEffect(function(){reload(limit);},[weekKey,limit]);

  function affectedDate(d){
    if(d.day)return planDayDate(d.week_key,d.day);

    // Older Phase 3D1 preview events stored the whole override object.
    // Derive the affected day(s) so those rows also become understandable.
    var before=d.before,after=d.after;
    if(!before||typeof before!=="object"||Array.isArray(before)||!after||typeof after!=="object"||Array.isArray(after))return "";
    var keys={};
    Object.keys(before).forEach(function(k){keys[k]=1;});
    Object.keys(after).forEach(function(k){keys[k]=1;});
    return DAYS.filter(function(day){return keys[day]&&!jsonEqual(before[day],after[day]);})
      .map(function(day){return planDayDate(d.week_key,day);}).join(", ");
  }

  function describe(row){
    var d=row.details||{};
    var action=d.action||row.action;
    var date=affectedDate(d);
    var dateSuffix=date?" from "+date:"";
    var map={
      shift_changed:(d.person_name||d.person_id)+" shift"+dateSuffix+": "+(d.before||"—")+" → "+(d.after||"—"),
      week_confirmed:"Week confirmed",
      week_unconfirmed:"Week confirmation removed",
      week_published:"Week published to team",
      week_unpublished:"Week unpublished",
      custom_shift_changed:"Custom shift changed",
      backup_changed:"Backup assignment changed",
      note_updated:"Note updated",
      adjustment_changed:"Hour adjustment changed",
      minOverride_changed:"Minimum staff override"+dateSuffix+" changed",
      u3Override_changed:"U3 override"+dateSuffix+" changed",
      over3Override_changed:"3+ override"+dateSuffix+" changed",
      week_updated:"Week settings updated",
      bulk_import:"Bulk import ("+(d.source||"unknown source")+")"
    };
    return map[action]||action||"Change";
  }

  function historyLine(row){
    var when=(formatBerlin(row.created_at)||"").replace(", "," ");
    var role=row.role_id||"unknown role";
    var email=row.user_email?" · "+row.user_email:"";
    return React.createElement(React.Fragment,null,
      React.createElement("span",{style:{fontWeight:700,color:C.primaryDark}},when),
      React.createElement("span",null," - "+describe(row)),
      React.createElement("span",{style:{fontSize:11.5,color:C.faint}}," by "+role+email)
    );
  }

  if(err){return React.createElement("div",{style:{color:C.gap,margin:"8px 0"}},err);}
  if(!items){return React.createElement("div",{style:{color:C.muted,margin:"8px 0"}},"Loading history...");}

  return React.createElement("div",{style:{background:C.surface,border:"1px solid "+C.line,borderRadius:10,padding:"12px 14px",marginBottom:12}},
    React.createElement("div",{style:{fontWeight:700,fontSize:14,marginBottom:8}},"History — this week"),
    items.length===0
      ? React.createElement("div",{style:{color:C.muted,fontSize:13}},"No recorded changes for this week yet.")
      : React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:10}},
          items.map(function(row){
            return React.createElement("div",{key:row.id,style:{borderBottom:"1px solid "+C.lineSoft,paddingBottom:8}},
              React.createElement("div",{style:{fontSize:12.5,color:C.ink}},historyLine(row))
            );
          })
        ),
    items.length>=limit&&React.createElement("button",{onClick:function(){setLimit(function(l){return l+50;});},style:Object.assign({},btnStyle,{marginTop:10,padding:"5px 12px",fontSize:12.5})},"Load more")
  );
}

function PlanView(props){
  var state=props.state,sm=props.sm,week=props.week,setWeek=props.setWeek,editable=props.editable;
  var setCell=props.setCell,setNote=props.setNote,setAdj=props.setAdj,setMinOverride=props.setMinOverride,toggleWeek=props.toggleWeek;
  var setU3Ov=props.setU3Ov,setOver3Ov=props.setOver3Ov,setBackupWeek=props.setBackupWeek,setCustomShift=props.setCustomShift||function(){};
  var wkIdx=props.wkIdx||0,prevWeek=props.prevWeek||function(){},nextWeek=props.nextWeek||function(){};
  var planUndo=props.planUndo||function(){},planRedo=props.planRedo||function(){};
  var undoStack=props.undoStack||[],redoStack=props.redoStack||[];
  var w=weekData(state,week);
  var shown=state.team.filter(function(p){return p.active||hasAssignInWeek(state,week,p.id);});
  var reqData=DAYS.map(function(d){return dayRequired(state,week,d);});
  var covs=DAYS.map(function(d,i){return dayCoverages(state,sm,week,d,reqData[i].effective);});
  var tsLog=state.timesheetLog||[];
  var educators=state.team.filter(function(p){return p.coverage&&!p.kitchen&&!p.cleaning&&!p.eltern&&!p.springer&&p.active;});
  var isCurrentWeek=wkIdx===currentWeekIndex();
  var todayCut=new Date(todayISO()+"T00:00:00");
  var dayIsPast=DAYS.map(function(d,i){
    if(!isCurrentWeek)return false;
    var wkMo=WEEKS[wkIdx]?WEEKS[wkIdx].mo:null;
    if(!wkMo)return false;
    var dd=new Date(wkMo);dd.setDate(wkMo.getDate()+i);dd.setHours(0,0,0,0);
    return dd<todayCut;
  });
  var historyOpenArr=useState(false); var historyOpen=historyOpenArr[0],setHistoryOpen=historyOpenArr[1];

  return React.createElement("section",null,
    /* top bar */
    React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:12}},
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}},
        React.createElement("button",{onClick:function(){setWeek(WEEKS[currentWeekIndex()].key);},style:Object.assign({},btnStyle,{padding:"5px 12px",fontSize:12.5,fontWeight:700})},"Current week"),
        React.createElement("button",{onClick:prevWeek,disabled:wkIdx===0,style:Object.assign({},btnStyle,{padding:"5px 10px",fontSize:14,opacity:wkIdx===0?0.3:1})},"←"),
        React.createElement("select",{value:week,onChange:function(e){setWeek(e.target.value);},style:selStyle},
          WEEKS.map(function(x){return React.createElement("option",{key:x.key,value:x.key},x.kw+" · "+x.range);})
        ),
        React.createElement("button",{onClick:nextWeek,disabled:wkIdx===WEEKS.length-1,style:Object.assign({},btnStyle,{padding:"5px 10px",fontSize:14,opacity:wkIdx===WEEKS.length-1?0.3:1})},"→"),
        w.published?React.createElement(Pill,{tone:"ok"},"Published"):React.createElement(Pill,{tone:"neutral"},"Draft"),
        React.createElement("button",{onClick:function(){setHistoryOpen(function(o){return !o;});},style:Object.assign({},btnStyle,{padding:"5px 12px",fontSize:12.5})},historyOpen?"Hide history":"History")
      ),
      editable && React.createElement("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
        React.createElement("button",{onClick:planUndo,disabled:!undoStack.length,title:"Undo last change in this week",style:Object.assign({},btnStyle,{padding:"8px 12px",opacity:undoStack.length?1:0.4})},"↩ Undo"),
        React.createElement("button",{onClick:planRedo,disabled:!redoStack.length,title:"Redo",style:Object.assign({},btnStyle,{padding:"8px 12px",opacity:redoStack.length?1:0.4})},"↪ Redo"),
        React.createElement("button",{onClick:function(){toggleWeek("confirmed");},style:Object.assign({},btnStyle,{background:w.confirmed?C.okBg:C.surface,color:w.confirmed?C.ok:C.primaryDark,borderColor:w.confirmed?C.ok:C.line})},w.confirmed?"✓ Confirmed":"Confirm week"),
        React.createElement("button",{onClick:function(){toggleWeek("published");},style:Object.assign({},btnStyle,{background:w.published?C.primary:C.surface,color:w.published?"#fff":C.primaryDark,borderColor:w.published?C.primary:C.line})},w.published?"Unpublish":"Publish to team")
      )
    ),
    historyOpen&&React.createElement(HistoryPanel,{weekKey:week}),
    /* U3 / U3+ panel + backup */
    React.createElement("div",{style:{background:C.surface,border:"1px solid "+C.line,borderRadius:10,padding:"10px 14px",marginBottom:12,overflowX:"auto"}},
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"120px repeat(5,1fr)",gap:6,fontSize:12,minWidth:560}},
        React.createElement("div",{style:{color:C.muted,fontWeight:600}}),
        DAYS.map(function(d){return React.createElement("div",{key:d,style:{fontWeight:700,textAlign:"center"}},d);}),
        React.createElement("div",{style:{color:C.muted,fontWeight:600,paddingTop:4}},"U3 children"),
        DAYS.map(function(d,i){
          return editable?React.createElement("input",{key:d,type:"number",min:"0",value:reqData[i]?reqData[i].u3:8,onChange:function(e){setU3Ov(d,e.target.value);},style:Object.assign({},numInput,{textAlign:"center",width:"100%"})})
            :React.createElement("div",{key:d,style:{textAlign:"center"}},reqData[i]?reqData[i].u3:8);
        }),
        React.createElement("div",{style:{color:C.muted,fontWeight:600}},"3+ children"),
        DAYS.map(function(d,i){
          return editable?React.createElement("input",{key:d,type:"number",min:"0",value:reqData[i]?reqData[i].u3p:20,onChange:function(e){setOver3Ov(d,e.target.value);},style:Object.assign({},numInput,{textAlign:"center",width:"100%"})})
            :React.createElement("div",{key:d,style:{textAlign:"center"}},reqData[i]?reqData[i].u3p:12);
        }),
        React.createElement("div",{style:{color:C.muted,fontWeight:600}},"Min. staff"),
        DAYS.map(function(d,i){
          var r=reqData[i]||{calc:5,manualMin:null,effective:5};
          var below=r.manualMin!=null&&r.manualMin<r.calc;
          return React.createElement("div",{key:d,style:{textAlign:"center"}},
            editable?React.createElement("input",{type:"number",min:"0",value:r.manualMin!=null?r.manualMin:"",placeholder:String(r.calc),onChange:function(e){setMinOverride(d,e.target.value);},style:Object.assign({},numInput,{textAlign:"center",width:"100%",borderColor:below?C.tight:C.line})})
              :React.createElement("span",null,String(r.effective)),
            below?React.createElement("div",{style:{fontSize:9.5,color:C.tight}},"below rule"):null
          );
        }),
        React.createElement("div",{style:{color:C.muted,fontWeight:600}},"Backup"),
        DAYS.map(function(d){
          var bpid=(w.backupByDay||{})[d]||"";
          var bname=(state.team.find(function(p){return p.id===bpid;})||{}).name||"—";
          return editable?React.createElement("select",{key:d,value:bpid,onChange:function(e){setBackupWeek(d,e.target.value);},style:Object.assign({},selStyle,{padding:"3px 5px",fontSize:11.5,width:"100%"})},
            React.createElement("option",{value:""},"— none —"),
            educators.map(function(p){return React.createElement("option",{key:p.id,value:p.id},p.name);}))
            :React.createElement("div",{key:d,style:{textAlign:"center",fontSize:11.5,color:C.muted}},bname);
        })
      )
    ),
    /* table */
    React.createElement("div",{style:{background:C.surface,border:"1px solid "+C.line,borderRadius:12,overflow:"hidden"}},
      React.createElement("div",{style:{overflowX:"auto"}},
        React.createElement("table",{style:{borderCollapse:"collapse",width:"100%",minWidth:960,fontSize:13.5}},
          React.createElement("thead",null,
            React.createElement("tr",{style:{background:C.lineSoft}},
              React.createElement("th",{style:Object.assign({},th,{textAlign:"left",minWidth:140})},"Team"),
              DAYS.map(function(d,i){
                var wkMo=WEEKS[wkIdx]?WEEKS[wkIdx].mo:null;
                var dayDate=wkMo?new Date(wkMo):null;
                if(dayDate)dayDate.setDate(wkMo.getDate()+i);
                var ddmm=dayDate?(String(dayDate.getDate()).padStart(2,"0")+"/"+String(dayDate.getMonth()+1).padStart(2,"0")):"";
                return React.createElement("th",{key:d,style:Object.assign({},th,{opacity:dayIsPast[i]?0.35:1})},d,
                  ddmm?React.createElement("div",{style:{fontSize:10,fontWeight:400,color:C.faint,marginTop:1}},ddmm):null
                );
              }),
              React.createElement("th",{style:Object.assign({},th,{borderLeft:"2px solid "+C.line})},"Target"),
              React.createElement("th",{style:th},"Actual"),
              React.createElement("th",{style:th},"Adj."),
              React.createElement("th",{style:th},"+/−"),
              React.createElement("th",{style:Object.assign({},th,{minWidth:150,textAlign:"left"})},"Notes")
            )
          ),
          React.createElement("tbody",null,
            shown.map(function(p){
              var pw=personWeek(state,sm,week,p,tsLog);
              var roleTag=p.eltern?"Elterndienst":p.springer?"Springer":p.kitchen?"Kitchen":p.cleaning?"Cleaning":null;
              var roleColor=p.eltern?C.eltern:p.springer?C.springer:p.kitchen?C.kitchen:p.cleaning?C.cleaning:null;
              return React.createElement("tr",{key:p.id,style:{borderTop:"1px solid "+C.lineSoft}},
                React.createElement("td",{style:Object.assign({},td,{textAlign:"left",fontWeight:600})},
                  p.name,
                  !p.active&&React.createElement("span",{style:{color:C.faint,fontSize:11,marginLeft:6}},"inactive"),
                  roleTag&&React.createElement("span",{style:{color:roleColor,fontSize:11,marginLeft:6}},roleTag),
                  pw.divergence&&React.createElement("span",{style:{color:C.warn,fontSize:11,marginLeft:6}},"⚠TS")
                ),
                DAYS.map(function(d,i){
                  var ab=absCodeForCell(state.absences||[],p.id,week,d);
                  var code=ab||cellCode(state,week,p.id,d);
                  var sh=sm[code];
                  var cs=w.customShifts&&w.customShifts[p.id]&&w.customShifts[p.id][d];
                  var isCustomCell=code==="Custom"&&!ab;
                  var conflict=sh&&sh.work&&!isCustomCell&&availConflict(sh,availVal(p,d));
                  var isSickCode=sh&&sh.sick;var isNonSickAbsence=sh&&!sh.work&&!sh.sick&&!sh.work;var bg=ab?(sm[ab]&&sm[ab].sick?"#F9E0E0":"#FDF3D0"):isCustomCell?"#FEF9EC":!sh?C.surface:sh.work?C.primarySoft:isSickCode?"#F9E0E0":sh.absence?"#FDF3D0":C.lineSoft;
                  var csLabel=cs&&cs.startTime!=null?(hToHMS(cs.startTime)+"-"+hToHMS(cs.endTime)):null;
                  return React.createElement("td",{key:d,style:Object.assign({},td,{padding:3,background:bg,outline:conflict?"2px solid "+C.tight:"none",outlineOffset:-2,opacity:dayIsPast[i]?0.35:1}),
                    title:ab?"Absence":(isCustomCell&&cs&&cs.note?cs.note:conflict?"Availability conflict":(sh?sh.label:""))},
                    ab?React.createElement("span",{style:{fontWeight:700,fontSize:13,color:C.warn}},ab)
                      :editable?(
                        React.createElement("div",null,
                          React.createElement("select",{value:code,onChange:function(e){setCell(p.id,d,e.target.value);if(e.target.value!=="Custom"){setCustomShift(p.id,d,null);}},style:cellSel},
                            React.createElement("option",{value:""},"—"),
                            React.createElement("optgroup",{label:"Shifts"},state.shifts.filter(function(x){return x.work;}).map(function(x){return React.createElement("option",{key:x.code,value:x.code},x.code);})),
                            React.createElement("optgroup",{label:"Absence / off"},state.shifts.filter(function(x){return !x.work;}).map(function(x){return React.createElement("option",{key:x.code,value:x.code},x.code);}))
                          ),
                          isCustomCell&&React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:2,marginTop:2}},
                            React.createElement("div",{style:{display:"flex",gap:2}},
                              React.createElement("input",{type:"time",value:cs&&cs.startTime!=null?hToHMS(cs.startTime):"09:00",
                                onChange:function(e){setCustomShift(p.id,d,Object.assign({},cs||{startTime:9,endTime:10,note:""},{startTime:hmsToH(e.target.value)!=null?hmsToH(e.target.value):9}));},
                                style:{fontSize:9.5,padding:"2px 3px",borderRadius:4,border:"1px solid "+C.line,width:70}}),
                              React.createElement("input",{type:"time",value:cs&&cs.endTime!=null?hToHMS(cs.endTime):"10:00",
                                onChange:function(e){setCustomShift(p.id,d,Object.assign({},cs||{startTime:9,endTime:10,note:""},{endTime:hmsToH(e.target.value)!=null?hmsToH(e.target.value):10}));},
                                style:{fontSize:9.5,padding:"2px 3px",borderRadius:4,border:"1px solid "+C.line,width:70}})
                            ),
                            React.createElement("input",{type:"text",value:cs&&cs.note?cs.note:"",placeholder:"note…",maxLength:60,
                              onChange:function(e){setCustomShift(p.id,d,Object.assign({},cs||{startTime:9,endTime:10,note:""},{note:e.target.value}));},
                              style:{fontSize:9.5,padding:"2px 4px",borderRadius:4,border:"1px solid "+C.line,width:"100%",boxSizing:"border-box"}})
                          )
                        )
                      )
                      :React.createElement("span",{style:{fontWeight:600}},isCustomCell&&csLabel?("C: "+csLabel):code||"—")
                  );
                }),
                React.createElement("td",{style:Object.assign({},td,{borderLeft:"2px solid "+C.line,color:C.muted})},pw.soll||"–"),
                React.createElement("td",{style:td},pw.hasAny?round(pw.ist):"–",pw.hasTs&&React.createElement("span",{style:{fontSize:10,color:C.warn,marginLeft:3}},"TS")),
                React.createElement("td",{style:Object.assign({},td,{padding:3})},
                  editable?React.createElement("input",{type:"number",step:"0.25",value:(w.adj||{})[p.id]||"",onChange:function(e){setAdj(p.id,e.target.value);},placeholder:"0",style:Object.assign({},numInput,{width:64})})
                    :React.createElement("span",null,(w.adj||{})[p.id]||0)
                ),
                React.createElement("td",{style:Object.assign({},td,{fontWeight:700,color:pw.delta>0.05?C.ok:pw.delta<-0.05?C.gap:C.muted})},pw.hasAny?(pw.delta>0?"+":"")+round(pw.delta):"–"),
                React.createElement("td",{style:Object.assign({},td,{padding:3,textAlign:"left"})},
                  editable?React.createElement("textarea",{value:(w.notes||{})[p.id]||"",onChange:function(e){setNote(p.id,e.target.value);e.target.style.height="auto";e.target.style.height=e.target.scrollHeight+"px";},placeholder:"—",rows:1,style:Object.assign({},txtInput,{width:"100%",minWidth:130,resize:"none",overflow:"hidden",lineHeight:"1.4",boxSizing:"border-box"})})
                    :React.createElement("span",{style:{color:C.muted}},(w.notes||{})[p.id]||"")
                )
              );
            }),
            /* coverage row */
            React.createElement("tr",{style:{borderTop:"2px solid "+C.line,background:C.lineSoft}},
              React.createElement("td",{style:Object.assign({},td,{textAlign:"left",fontWeight:700})},"Coverage"),
              covs.map(function(c,i){
                return React.createElement("td",{key:i,style:td},
                  React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"center",gap:5,flexWrap:"wrap"}},
                    React.createElement(StatusDot,{status:c.status}),
                    React.createElement("b",{style:{color:c.status==="gap"?C.gap:C.ink}},c.count),
                    React.createElement("span",{style:{color:C.faint}},"/"+c.min)
                  ),
                  React.createElement("div",{style:{display:"flex",justifyContent:"center",gap:4,marginTop:3}},
                    React.createElement("span",{title:"Kitchen",style:{fontSize:10,color:c.kitchenOk?C.ok:C.gap}},c.kitchenOk?"🍳✓":"🍳✗"),
                    React.createElement("span",{title:"Cleaning",style:{fontSize:10,color:c.cleaningOk?C.ok:C.gap}},c.cleaningOk?"🧹✓":"🧹✗")
                  )
                );
              }),
              React.createElement("td",{colSpan:4})
            )
          )
        )
      )
    ),
    /* hourly bars */
    React.createElement("div",{style:{marginTop:14,display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:12}},
      DAYS.map(function(d,i){
        var slots=buildDayGantt(state,sm,week,d);
        var c=covs[i];
        return React.createElement("div",{key:d,style:{background:C.surface,border:"1px solid "+(c.status==="gap"?C.gap:c.status==="tight"?C.tight:C.line),borderRadius:10,padding:"10px 12px"}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}},
            React.createElement("span",{style:{fontWeight:700,fontSize:13}},d),
            React.createElement(StatusDot,{status:c.status})
          ),
          React.createElement(HourlyCoverageBar,{slots:slots,min:c.min})
        );
      })
    ),
    /* alerts */
    React.createElement("div",{style:{marginTop:14,display:"grid",gap:8}},
      (function(){
        var backupByDay=(w.backupByDay)||{};
        var teamById={};state.team.forEach(function(p){teamById[p.id]=p;});
        var hasIssue=covs.some(function(c){return c.gap>0||!c.kitchenOk||!c.cleaningOk||c.parentOnly;});
        if(!hasIssue)return React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10,background:C.okBg,borderRadius:10,padding:"10px 14px",color:C.ok,fontWeight:600}},React.createElement(StatusDot,{status:"ok"}),"Full coverage every day — children, kitchen and cleaning.");
        return covs.map(function(c,i){
          var d=DAYS[i];
          var absentPids=state.team.filter(function(p){var ab=absCodeForCell(state.absences||[],p.id,week,d);var code=ab||cellCode(state,week,p.id,d);var sh=sm[code];return p.coverage&&!p.kitchen&&!p.cleaning&&!p.eltern&&(sh&&!sh.work||!code);}).map(function(p){return p.id;});
          var recs=buildRecommendation(c,backupByDay[d],absentPids,teamById);
          if(!recs.length)return null;
          var isCritical=c.parentOnly;
          return React.createElement("div",{key:i,style:{display:"flex",alignItems:"flex-start",gap:10,background:isCritical?"#FEF0ED":C.gapBg,border:"1px solid "+(isCritical?C.gap:C.gap)+"33",borderRadius:10,padding:"10px 14px",flexWrap:"wrap"}},
            React.createElement(StatusDot,{status:c.gap>0?"gap":"tight"}),
            React.createElement("b",{style:{minWidth:32}},DAYS[i]),
            React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:4}},recs.map(function(r,j){
              var isCrit=r.type==="critical",isWarn=r.type==="warn",isSupport=r.type==="support";
              var isNoBackup=r.type==="backup"&&r.text.indexOf("No backup")===0;
              var isSpringer=r.type==="springer";
              if(r.bold!=null){
                return React.createElement("span",{key:j,style:{color:C.gap,fontWeight:700,fontSize:13}},
                  r.text," → ",React.createElement("b",null,String(r.bold))," "+(r.suffix||""));
              }
              var color=isCrit?C.gap:isWarn?C.tight:isNoBackup?C.faint:isSpringer?C.muted:C.ink;
              var fw=isCrit?700:isWarn?600:400;
              return React.createElement("span",{key:j,style:{color:color,fontWeight:fw,fontSize:12}},r.text);
            }))
          );
        });
      })()
    ),
    /* shift legend */
    React.createElement("div",{style:{marginTop:18}},
      React.createElement(Eyebrow,null,"Shift catalogue"),
      React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:8,marginTop:10}},
        state.shifts.map(function(s){
          return React.createElement("div",{key:s.code,style:{background:C.surface,border:"1px solid "+C.line,borderRadius:8,padding:"6px 10px",fontSize:12.5}},
            React.createElement("b",null,s.code)," ",React.createElement("span",{style:{color:C.muted}},"· "+s.label)," ",
            s.work?React.createElement("span",{style:{color:C.primary,fontWeight:600}},s.hours+"h"):React.createElement("span",{style:{color:C.faint}},"0h")
          );
        })
      )
    )
  );
}

/* ================================================================== */
function ForecastView(props){
  var state=props.state,sm=props.sm,setWeek=props.setWeek,setTab=props.setTab;
  var curIdx=currentWeekIndex();
  var planned=WEEKS.filter(function(w,i){return i>=curIdx&&state.weeks[w.key]&&Object.values(state.weeks[w.key].assign||{}).some(function(a){return Object.keys(a).length;});});
  return React.createElement("section",null,
    React.createElement(Eyebrow,null,"Anticipate staffing needs"),
    React.createElement("h2",{style:{margin:"4px 0 4px",fontSize:19,fontWeight:700}},"Where the schedule gets tight"),
    React.createElement("p",{style:{color:C.muted,fontSize:14,margin:"0 0 18px",maxWidth:640}},"Red = too few staff with children. 🍳✗ = no kitchen. 🧹✗ = no cleaning. Only weeks with a schedule are shown."),
    planned.length===0?React.createElement("div",{style:emptyBox},"No scheduled weeks yet."):
    React.createElement("div",{style:{display:"grid",gap:10}},
      planned.map(function(w){
        var covs=DAYS.map(function(d){return dayCoverages(state,sm,w.key,d,dayRequired(state,w.key,d).effective);});
        var wBackup=(weekData(state,w.key).backupByDay)||{};
        var wTeamById={};state.team.forEach(function(p){wTeamById[p.id]=p;});
        var anyIssue=covs.some(function(c){return c.gap>0||!c.kitchenOk||!c.cleaningOk||c.parentOnly;});
        var todayCut=new Date(todayISO()+"T00:00:00");
        var wIsCurrent=(w.key===WEEKS[curIdx].key);
        var wDayIsPast=DAYS.map(function(d,i){
          if(!wIsCurrent)return false;
          var dd=new Date(w.mo);dd.setDate(w.mo.getDate()+i);dd.setHours(0,0,0,0);
          return dd<todayCut;
        });
        return React.createElement("div",{key:w.key,style:{background:C.surface,border:"1px solid "+C.line,borderRadius:12,padding:"14px 16px"}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}},
            React.createElement("button",{onClick:function(){setWeek(w.key);setTab("plan");},style:linkBtn},React.createElement("b",{style:{fontSize:15}},w.kw)," ",React.createElement("span",{style:{color:C.muted,fontWeight:400}},"· "+w.range)),
            anyIssue?React.createElement(Pill,{tone:"gap"},"needs attention"):React.createElement(Pill,{tone:"ok"},"all covered")
          ),
          React.createElement("div",{style:{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}},
            covs.map(function(c,i){
              var recs=buildRecommendation(c,wBackup[DAYS[i]],[], wTeamById);
              return React.createElement("div",{key:i,style:{flex:"1 1 110px",minWidth:110,borderRadius:9,padding:"8px 10px",background:recs.length?C.gapBg:C.okBg,opacity:wDayIsPast[i]?0.35:1}},
                React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"}},React.createElement("span",{style:{fontWeight:700,fontSize:13}},DAYS[i]),React.createElement(StatusDot,{status:c.status})),
                React.createElement("div",{style:{fontSize:12,marginTop:4,color:C.muted}},React.createElement("b",{style:{color:c.status==="gap"?C.gap:C.ink}},c.count),"/"+c.min+" with children"),
                React.createElement("div",{style:{fontSize:11,marginTop:2}},React.createElement("span",{style:{color:c.kitchenOk?C.ok:C.gap}},"🍳"+(c.kitchenOk?"✓":"✗"))," ",React.createElement("span",{style:{color:c.cleaningOk?C.ok:C.gap}},"🧹"+(c.cleaningOk?"✓":"✗")),c.parentOnly?" ":""," ",c.parentOnly?React.createElement("span",{style:{color:C.gap,fontWeight:700}},"👨‍👩‍👧 no educator!"):""),
                recs.length>0&&React.createElement("div",{style:{fontSize:11.5,marginTop:4,color:C.gap,fontWeight:600}},
                React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:2}},
                recs.map(function(r,ri){
                  var isCrit=r.type==="critical",isWarn=r.type==="warn";
                  var isNoBackup=r.type==="backup"&&r.text.indexOf("No backup")===0;
                  var isSpringer=r.type==="springer";
                  var color=isCrit?C.gap:isWarn?C.tight:isNoBackup?C.faint:isSpringer?C.muted:C.gap;
                  var fw=r.bold!=null?700:isCrit?700:isWarn?600:400;
                  if(r.bold!=null)return React.createElement("span",{key:ri,style:{fontSize:11,color:C.gap,fontWeight:700}},r.text+" → ",React.createElement("b",null,String(r.bold))," "+(r.suffix||""));
                  return React.createElement("span",{key:ri,style:{fontSize:11,color:color,fontWeight:fw}},r.text);
                })
              ))
              );
            })
          ),
          React.createElement("div",{style:{marginTop:10}},
            React.createElement(Eyebrow,null,"Hourly coverage"),
            React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginTop:6}},
              DAYS.map(function(d,di){
                var slots=buildDayGantt(state,sm,w.key,d);
                var cv=covs[di];
                return React.createElement("div",{key:d,style:{background:C.surface,border:"1px solid "+(cv.status==="gap"?C.gap:cv.status==="tight"?C.tight:C.line),borderRadius:8,padding:"7px 8px",opacity:wDayIsPast[di]?0.35:1}},
                  React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}},
                    React.createElement("span",{style:{fontWeight:700,fontSize:11}},d),
                    React.createElement(StatusDot,{status:cv.status})
                  ),
                  React.createElement(HourlyCoverageBar,{slots:slots,min:cv.min})
                );
              })
            )
          )
        );
      })
    )
  );
}

/* ================================================================== */
function AbsencesView(props){
  var state=props.state,sm=props.sm,update=props.update,editable=props.editable,viewerPid=props.viewerPid;
  var absUndo=props.absUndo||function(){},absRedo=props.absRedo||function(){};
  var absUndoStack=props.absUndoStack||[],absRedoStack=props.absRedoStack||[];
  var absCodes=state.shifts.filter(function(s){return s.absence;});
  var team=state.team.filter(function(p){return p.active||hasAnyData(state,p.id);});
  var pidArr=useState(team[0]?team[0].id:""); var pid=pidArr[0],setPid=pidArr[1];
  var typeArr=useState("Vacation"); var type=typeArr[0],setType=typeArr[1];
  var dfArr=useState(todayISO()); var dateFrom=dfArr[0],setDateFrom=dfArr[1];
  var dtArr=useState(todayISO()); var dateTo=dtArr[0],setDateTo=dtArr[1];
  var eiArr=useState(null); var editId=eiArr[0],setEditId=eiArr[1];
  var etArr=useState(""); var editType=etArr[0],setEditType=etArr[1];
  var afpArr=useState("all"); var filterPid=afpArr[0],setFilterPid=afpArr[1];
  var afcArr=useState("all"); var filterCat=afcArr[0],setFilterCat=afcArr[1];
  var aftArr=useState("upcoming"); var timeFilter=aftArr[0],setTimeFilter=aftArr[1];

  function addAbsences(){
    var start=new Date(dateFrom+"T12:00:00"),end=new Date(dateTo+"T12:00:00");
    var entries=[];
    var now=new Date(); now.setHours(0,0,0,0);
    var thirtyDaysMs=30*24*60*60*1000;
    for(var d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
      var dc=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
      if(!DAYS.includes(dc))continue;
      var daysAhead=Math.round((d-now)/86400000);
      var lateNotice=(type==="Vacation"&&daysAhead<30);
      var autoApply=(type==="Sick"||type==="Sick-K"||type==="Holiday");
      var submitterPid=editable?pid:(viewerPid||pid);
      entries.push({id:uid(),pid:submitterPid,date:d.toISOString().slice(0,10),code:type,lateNotice:lateNotice,status:autoApply?"approved":"pending",createdAt:todayISO()});
    }
    update(function(s){s.absences=(s.absences||[]).concat(entries);return s;});
    setFilterPid("all");
    setFilterCat("all");
  }
  function removeAbsence(id){update(function(s){s.absences=(s.absences||[]).filter(function(a){return a.id!==id;});return s;});}
  function approveAbsence(id){update(function(s){var a=(s.absences||[]).find(function(x){return x.id===id;});if(a)a.status="approved";return s;});}
  function rejectAbsence(id){update(function(s){var a=(s.absences||[]).find(function(x){return x.id===id;});if(a)a.status="rejected";return s;});}
  function saveEdit(id){update(function(s){var a=(s.absences||[]).find(function(x){return x.id===id;});if(a)a.code=editType;return s;});setEditId(null);}
  function personName(id){var p=state.team.find(function(x){return x.id===id;});return p?p.name:id;}

  // Defensive + filter
  var SICK_CODES_ABS=["Sick","Sick-K"];
  var rawAbs=(state.absences||[]).filter(function(a){
    if(!a||!a.id||!a.pid||!a.date||!a.code) return false;
    if(filterPid!=="all"&&a.pid!==filterPid) return false;
    if(filterCat==="krank"&&SICK_CODES_ABS.indexOf(a.code)<0) return false;
    if(filterCat==="nicht_krank"&&SICK_CODES_ABS.indexOf(a.code)>=0) return false;
    return true;
  });
  // Derive absences from Weekly Plan (read-only, no duplicates)
  var planDerived=[];
  var ABSENCE_SH_CODES=["Sick","Sick-K","Vacation","Off","Holiday","FFU","Limpieza","Cocina"];
  Object.keys(state.weeks||{}).forEach(function(wk){
    var wd=state.weeks[wk];
    var wkObj=WEEKS.find(function(x){return x.key===wk;});
    if(!wkObj)return;
    var wkMo=wkObj.mo;
    state.team.forEach(function(p){
      DAYS.forEach(function(d,di){
        var code=cellCode(state,wk,p.id,d);
        if(!code)return;
        var sh=(state.shifts||[]).find(function(s){return s.code===code;});
        if(!sh||!sh.absence)return;
        // Compute date
        var absDate=new Date(wkMo);
        absDate.setDate(wkMo.getDate()+di);
        var isoDate=absDate.getFullYear()+"-"+String(absDate.getMonth()+1).padStart(2,"0")+"-"+String(absDate.getDate()).padStart(2,"0");
        // Skip if already in formal absences (same pid+date+code)
        var alreadyFormal=rawAbs.some(function(a){return a.pid===p.id&&a.date===isoDate&&a.code===code;});
        if(alreadyFormal)return;
        // Apply active filters
        if(filterPid!=="all"&&p.id!==filterPid)return;
        if(filterCat==="krank"&&["Sick","Sick-K"].indexOf(code)<0)return;
        if(filterCat==="nicht_krank"&&["Sick","Sick-K"].indexOf(code)>=0)return;
        planDerived.push({id:"plan-"+wk+"-"+p.id+"-"+d,pid:p.id,date:isoDate,code:code,status:"planned",source:"from_plan",_readOnly:true});
      });
    });
  });
  var list=rawAbs.concat(planDerived).slice().sort(function(a,b){return a.date.localeCompare(b.date);});
  var todayStr=todayISO();
  list=list.filter(function(a){
    if(timeFilter==="upcoming")return a.date>=todayStr;
    if(timeFilter==="past")return a.date<todayStr;
    return true;
  });

  return React.createElement("section",null,
    React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:4}},
      React.createElement("div",null,
        React.createElement(Eyebrow,null,"Absences"),
        React.createElement("h2",{style:{margin:"2px 0 0",fontSize:19,fontWeight:700}},"Absences")
      ),
      editable&&React.createElement("div",{style:{display:"flex",gap:8}},
        React.createElement("button",{onClick:absUndo,disabled:!absUndoStack.length,title:"Undo last absence change",style:Object.assign({},btnStyle,{padding:"6px 11px",opacity:absUndoStack.length?1:0.4})},"↩ Undo"),
        React.createElement("button",{onClick:absRedo,disabled:!absRedoStack.length,title:"Redo",style:Object.assign({},btnStyle,{padding:"6px 11px",opacity:absRedoStack.length?1:0.4})},"↪ Redo")
      )
    ),
    React.createElement("div",{style:{background:C.surface,border:"1px solid "+C.line,borderRadius:12,padding:16,display:"flex",gap:14,flexWrap:"wrap",alignItems:"flex-end"}},
      React.createElement(Field,{label:"Team member"},React.createElement("select",{value:pid,onChange:function(e){setPid(e.target.value);},style:selStyle},team.map(function(p){return React.createElement("option",{key:p.id,value:p.id},p.name);}))),
      React.createElement(Field,{label:"Type"},React.createElement("select",{value:type,onChange:function(e){setType(e.target.value);},style:selStyle},absCodes.map(function(s){return React.createElement("option",{key:s.code,value:s.code},s.code+" — "+s.label);}))),
      React.createElement(Field,{label:"From"},React.createElement("input",{type:"date",value:dateFrom,onChange:function(e){setDateFrom(e.target.value);},style:selStyle})),
      React.createElement(Field,{label:"To"},React.createElement("input",{type:"date",value:dateTo,onChange:function(e){setDateTo(e.target.value);},style:selStyle})),
      React.createElement("button",{onClick:addAbsences,style:Object.assign({},btnStyle,{background:C.primary,color:"#fff",borderColor:C.primary})},"Save absence")
    ),
    editable&&React.createElement("div",{style:{marginTop:16}},
      React.createElement("div",{style:{display:"flex",gap:10,marginBottom:8,flexWrap:"wrap",alignItems:"center"}},
        React.createElement("span",{style:{fontSize:12.5,fontWeight:600,color:C.muted}},"Filter:"),
        React.createElement("select",{value:filterPid,onChange:function(e){setFilterPid(e.target.value);},style:Object.assign({},selStyle,{padding:"5px 8px",fontSize:12.5})},
          React.createElement("option",{value:"all"},"All people"),
          team.map(function(p){return React.createElement("option",{key:p.id,value:p.id},p.name);})
        ),
        React.createElement("select",{value:filterCat,onChange:function(e){setFilterCat(e.target.value);},style:Object.assign({},selStyle,{padding:"5px 8px",fontSize:12.5})},
          React.createElement("option",{value:"all"},"All categories"),
          React.createElement("option",{value:"krank"},"Krank (sick)"),
          React.createElement("option",{value:"nicht_krank"},"Nicht krank (other)")
        ),
        React.createElement("select",{value:timeFilter,onChange:function(e){setTimeFilter(e.target.value);},style:Object.assign({},selStyle,{padding:"5px 8px",fontSize:12.5})},
          React.createElement("option",{value:"upcoming"},"Upcoming"),
          React.createElement("option",{value:"past"},"Past"),
          React.createElement("option",{value:"all"},"All")
        )
      ),
      React.createElement("div",{style:{background:C.surface,border:"1px solid "+C.line,borderRadius:12,overflow:"hidden"}},
      list.length===0?React.createElement("div",{style:{padding:20,color:C.muted,fontSize:14}},"No absences yet. Add above or mark directly on the weekly plan."):
      React.createElement("table",{style:{borderCollapse:"collapse",width:"100%",fontSize:13.5}},
        React.createElement("thead",null,React.createElement("tr",{style:{background:C.lineSoft}},
          React.createElement("th",{style:Object.assign({},th,{textAlign:"left"})},"Team member"),
          React.createElement("th",{style:Object.assign({},th,{textAlign:"left"})},"Date"),
          React.createElement("th",{style:Object.assign({},th,{textAlign:"left"})},"Day"),
          React.createElement("th",{style:Object.assign({},th,{textAlign:"left"})},"Type"),
          React.createElement("th",{style:th,colSpan:2},"Actions")
        )),
        React.createElement("tbody",null,list.map(function(a){
          var sh=sm[a.code];
          return React.createElement("tr",{key:a.id,style:{borderTop:"1px solid "+C.lineSoft}},
            React.createElement("td",{style:Object.assign({},td,{textAlign:"left",fontWeight:600})},personName(a.pid)),
            React.createElement("td",{style:Object.assign({},td,{textAlign:"left"})},isoToDisplay(a.date)),
            React.createElement("td",{style:Object.assign({},td,{textAlign:"left",color:C.muted})},DAY_NAMES[isoDayCode(a.date)]||""),
            React.createElement("td",{style:Object.assign({},td,{textAlign:"left"})},
              editId===a.id?React.createElement("select",{value:editType,onChange:function(e){setEditType(e.target.value);},style:Object.assign({},cellSel,{width:120})},absCodes.map(function(s){return React.createElement("option",{key:s.code,value:s.code},s.code);}))
                :React.createElement(React.Fragment,null,
                    React.createElement(Pill,{tone:sh&&sh.vacation?"ok":sh&&sh.sick?"gap":"neutral"},a.code),
                    a._readOnly?React.createElement(Pill,{tone:"neutral",style:{marginLeft:4}},"planned"):React.createElement(Pill,{tone:a.status==="approved"?"ok":a.status==="rejected"?"gap":"neutral",style:{marginLeft:4}},a.status||(sh&&(sh.sick||sh.holiday)?"approved":"pending")),
                    a._readOnly&&React.createElement("span",{style:{marginLeft:6,fontSize:10.5,color:C.faint}},"from plan"),
                    a.lateNotice&&React.createElement("span",{style:{marginLeft:6,fontSize:11,color:C.tight,fontWeight:600}},"⚠ less than 30 days")
                  )
            ),
            React.createElement("td",{style:td},
              editId===a.id?React.createElement(React.Fragment,null,React.createElement("button",{onClick:function(){saveEdit(a.id);},style:Object.assign({},miniBtn,{color:C.ok})},"save"),React.createElement("button",{onClick:function(){setEditId(null);},style:Object.assign({},miniBtn,{color:C.muted})},"cancel"))
                :React.createElement(React.Fragment,null,
                    !a._readOnly&&React.createElement("button",{onClick:function(){setEditId(a.id);setEditType(a.code);},style:Object.assign({},miniBtn,{color:C.muted})},"edit"),
                    !a._readOnly&&editable&&(a.status==="pending"||!a.status)&&React.createElement("button",{onClick:function(){approveAbsence(a.id);},style:Object.assign({},miniBtn,{color:C.ok})},"✓"),
                    editable&&(a.status==="pending"||!a.status)&&React.createElement("button",{onClick:function(){rejectAbsence(a.id);},style:Object.assign({},miniBtn,{color:C.gap})},"✗")
                  )
            ),
            React.createElement("td",{style:td},!a._readOnly&&React.createElement("button",{onClick:function(){removeAbsence(a.id);},style:Object.assign({},miniBtn,{color:C.gap})},"delete"))
          );
        }))
      )
      )
    )
  );
}

/* ================================================================== */
function TimesheetView(props){
  var state=props.state,sm=props.sm,update=props.update,editable=props.editable,viewerPid=props.viewerPid;
  var spArr=useState(state.team.find(function(p){return p.active;})?state.team.find(function(p){return p.active;}).id:""); var selPid=spArr[0],setSelPid=spArr[1];
  var rowsArr=useState([{id:uid(),date:todayISO(),timeIn:"09:00",timeOut:"15:00",note:""}]); var rows=rowsArr[0],setRows=rowsArr[1];
  var lfArr=useState("all"); var logFilter=lfArr[0],setLogFilter=lfArr[1];

  function addRow(){setRows(function(r){return r.concat([{id:uid(),date:todayISO(),timeIn:"09:00",timeOut:"15:00",note:""}]);});}
  function setRow(id,f,v){setRows(function(r){return r.map(function(x){return x.id===id?Object.assign({},x,{[f]:v}):x;});});}
  function removeRow(id){setRows(function(r){return r.filter(function(x){return x.id!==id;});});}
  function submit(){
    var pid=editable?selPid:viewerPid;
    var entries=rows.map(function(r){return{id:uid(),pid:pid,date:r.date,timeIn:r.timeIn,timeOut:r.timeOut,hours:round(hoursFromTimes(r.timeIn,r.timeOut)),note:r.note,submittedAt:new Date().toISOString()};});
    update(function(s){s.timesheetLog=(s.timesheetLog||[]).concat(entries);return s;});
    setRows([{id:uid(),date:todayISO(),timeIn:"09:00",timeOut:"15:00",note:""}]);
  }
  function getDivergence(e){
    var wk=isoWeekKey(e.date),dc=isoDayCode(e.date);
    if(!wk||!dc)return null;
    var ab=absCodeForCell(state.absences||[],e.pid,wk,dc);
    var planCode=ab||cellCode(state,wk,e.pid,dc);
    var ps=sm[planCode];if(!ps||!ps.work)return null;
    var diff=Math.abs(e.hours-ps.hours);
    return diff>0.1?{planned:ps.hours,actual:e.hours,diff:round(diff)}:null;
  }
  function personName(id){var p=state.team.find(function(x){return x.id===id;});return p?p.name:id;}

  var log=state.timesheetLog||[];
  var filteredLog=editable&&logFilter!=="all"?log.filter(function(e){return e.pid===logFilter;}):editable?log:log.filter(function(e){return e.pid===viewerPid;});

  return React.createElement("section",null,
    React.createElement(Eyebrow,null,editable?"Timesheet log — all team":"My timesheet"),
    React.createElement("h2",{style:{margin:"4px 0 12px",fontSize:19,fontWeight:700}},editable?"Timesheet":"Log your hours"),
    React.createElement("div",{style:{background:C.surface,border:"1px solid "+C.line,borderRadius:12,padding:16,marginBottom:16}},
      React.createElement("div",{style:{fontWeight:700,fontSize:14,marginBottom:10}},"Submit hours worked"),
      editable&&React.createElement("div",{style:{marginBottom:12}},React.createElement(Field,{label:"Team member"},React.createElement("select",{value:selPid,onChange:function(e){setSelPid(e.target.value);},style:selStyle},state.team.filter(function(p){return p.active;}).map(function(p){return React.createElement("option",{key:p.id,value:p.id},p.name);})))),
      React.createElement("div",{style:{overflowX:"auto"}},
        React.createElement("table",{style:{borderCollapse:"collapse",width:"100%",fontSize:13}},
          React.createElement("thead",null,React.createElement("tr",{style:{background:C.lineSoft}},React.createElement("th",{style:Object.assign({},th,{textAlign:"left"})},"Date"),React.createElement("th",{style:th},"Start"),React.createElement("th",{style:th},"End"),React.createElement("th",{style:th},"Hours"),React.createElement("th",{style:Object.assign({},th,{textAlign:"left"})},"Note"),React.createElement("th",{style:th}))),
          React.createElement("tbody",null,rows.map(function(r){
            return React.createElement("tr",{key:r.id,style:{borderTop:"1px solid "+C.lineSoft}},
              React.createElement("td",{style:Object.assign({},td,{padding:4})},React.createElement("input",{type:"date",value:r.date,onChange:function(e){setRow(r.id,"date",e.target.value);},style:selStyle})),
              React.createElement("td",{style:Object.assign({},td,{padding:4})},React.createElement("input",{type:"time",value:r.timeIn,onChange:function(e){setRow(r.id,"timeIn",e.target.value);},style:Object.assign({},selStyle,{width:110})})),
              React.createElement("td",{style:Object.assign({},td,{padding:4})},React.createElement("input",{type:"time",value:r.timeOut,onChange:function(e){setRow(r.id,"timeOut",e.target.value);},style:Object.assign({},selStyle,{width:110})})),
              React.createElement("td",{style:Object.assign({},td,{color:C.primary,fontWeight:700})},round(hoursFromTimes(r.timeIn,r.timeOut))+"h"),
              React.createElement("td",{style:Object.assign({},td,{padding:4})},React.createElement("input",{value:r.note,onChange:function(e){setRow(r.id,"note",e.target.value);},placeholder:"optional",style:Object.assign({},txtInput,{width:"100%",minWidth:120})})),
              React.createElement("td",{style:td},rows.length>1&&React.createElement("button",{onClick:function(){removeRow(r.id);},style:Object.assign({},miniBtn,{color:C.faint})},"✕"))
            );
          }))
        )
      ),
      React.createElement("div",{style:{display:"flex",gap:8,marginTop:10}},
        React.createElement("button",{onClick:addRow,style:Object.assign({},btnStyle,{padding:"7px 12px",fontSize:13})},"+ Add day"),
        React.createElement("button",{onClick:submit,style:Object.assign({},btnStyle,{background:C.primary,color:"#fff",borderColor:C.primary})},"Submit")
      )
    ),
    React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}},
      React.createElement("div",{style:{fontWeight:700,fontSize:14}},"Submitted entries"),
      editable&&React.createElement(Field,{label:"Filter"},React.createElement("select",{value:logFilter,onChange:function(e){setLogFilter(e.target.value);},style:Object.assign({},selStyle,{padding:"6px 10px"})},React.createElement("option",{value:"all"},"All"),state.team.filter(function(p){return p.active;}).map(function(p){return React.createElement("option",{key:p.id,value:p.id},p.name);})))
    ),
    React.createElement("div",{style:{background:C.surface,border:"1px solid "+C.line,borderRadius:12,overflow:"hidden",overflowX:"auto"}},
      filteredLog.length===0?React.createElement("div",{style:{padding:20,color:C.muted,fontSize:14}},"No entries yet."):
      React.createElement("table",{style:{borderCollapse:"collapse",width:"100%",fontSize:13}},
        React.createElement("thead",null,React.createElement("tr",{style:{background:C.lineSoft}},
          editable&&React.createElement("th",{style:Object.assign({},th,{textAlign:"left"})},"Team member"),
          React.createElement("th",{style:Object.assign({},th,{textAlign:"left"})},"Date"),React.createElement("th",{style:th},"Start"),React.createElement("th",{style:th},"End"),React.createElement("th",{style:th},"Hours"),React.createElement("th",{style:Object.assign({},th,{textAlign:"left"})},"Divergence"),React.createElement("th",{style:Object.assign({},th,{textAlign:"left"})},"Note"),editable&&React.createElement("th",{style:th})
        )),
        React.createElement("tbody",null,[].concat(filteredLog).sort(function(a,b){return b.date.localeCompare(a.date);}).map(function(e){
          var div=getDivergence(e);
          return React.createElement("tr",{key:e.id,style:{borderTop:"1px solid "+C.lineSoft}},
            editable&&React.createElement("td",{style:Object.assign({},td,{textAlign:"left",fontWeight:600})},personName(e.pid)),
            React.createElement("td",{style:Object.assign({},td,{textAlign:"left"})},isoToDisplay(e.date)," ",React.createElement("span",{style:{color:C.faint,fontSize:11}},DAY_NAMES[isoDayCode(e.date)]||"")),
            React.createElement("td",{style:td},e.timeIn),React.createElement("td",{style:td},e.timeOut),
            React.createElement("td",{style:Object.assign({},td,{fontWeight:700,color:C.primary})},e.hours+"h"),
            React.createElement("td",{style:Object.assign({},td,{textAlign:"left"})},div?React.createElement(Pill,{tone:"warn"},"Plan "+div.planned+"h · diff "+(div.diff>0?"+":"")+div.diff+"h"):React.createElement("span",{style:{color:C.faint}},"—")),
            React.createElement("td",{style:Object.assign({},td,{textAlign:"left",color:C.muted,fontSize:12})},e.note),
            editable&&React.createElement("td",{style:td},React.createElement("button",{onClick:function(){update(function(s){s.timesheetLog=(s.timesheetLog||[]).filter(function(x){return x.id!==e.id;});return s;});},style:Object.assign({},miniBtn,{color:C.gap})},"delete"))
          );
        }))
      )
    )
  );
}

/* ================================================================== */
function BalancesView(props){
  var state=props.state,sm=props.sm,update=props.update,editable=props.editable;
  var tsLog=state.timesheetLog||[];
  var rows=balances(state,sm).filter(function(p){return p.active||hasAnyData(state,p.id);});
  function setNote(id,val){update(function(s){var p=s.team.find(function(x){return x.id===id;});if(p)p.note=val;return s;});}
  return React.createElement("section",null,
    React.createElement(Eyebrow,null,"Leave & Time Balance"),
    React.createElement("h2",{style:{margin:"4px 0 4px",fontSize:19,fontWeight:700}},"Leave & Time Balance"),
    React.createElement("p",{style:{color:C.muted,fontSize:14,margin:"0 0 18px",maxWidth:660}},"Overtime counts only ",React.createElement("b",null,"confirmed")," weeks. ",React.createElement(Pill,{tone:"warn"},"TS")," means that week's total was overridden by a submitted timesheet."),
    React.createElement("div",{style:{background:C.surface,border:"1px solid "+C.line,borderRadius:12,overflow:"hidden",overflowX:"auto"}},
      React.createElement("table",{style:{borderCollapse:"collapse",width:"100%",minWidth:720,fontSize:13.5}},
        React.createElement("thead",null,React.createElement("tr",{style:{background:C.lineSoft}},
          React.createElement("th",{style:Object.assign({},th,{textAlign:"left"})},"Team member"),React.createElement("th",{style:th},"Vacation used"),React.createElement("th",{style:th},"Vacation left"),React.createElement("th",{style:th},"Sick (days)"),React.createElement("th",{style:th},"Overtime"),React.createElement("th",{style:Object.assign({},th,{textAlign:"left",minWidth:180})},"Notes")
        )),
        React.createElement("tbody",null,rows.map(function(p){
          var hasTsOt=WEEKS.some(function(w){var pw=personWeek(state,sm,w.key,p,tsLog);return weekData(state,w.key).confirmed&&pw.hasTs;});
          return React.createElement("tr",{key:p.id,style:{borderTop:"1px solid "+C.lineSoft}},
            React.createElement("td",{style:Object.assign({},td,{textAlign:"left",fontWeight:600})},p.name,!p.active&&React.createElement("span",{style:{color:C.faint,fontSize:11,marginLeft:6}},"inactive"),hasTsOt&&React.createElement("span",{style:{marginLeft:6}},React.createElement(Pill,{tone:"warn"},"TS"))),
            React.createElement("td",{style:td},p.vacTaken),
            React.createElement("td",{style:td},React.createElement(Pill,{tone:p.vacLeft<0?"gap":p.vacLeft<=5?"tight":"neutral"},p.vacLeft+" / "+p.vacationAllowance)),
            React.createElement("td",{style:td},p.sick),
            React.createElement("td",{style:Object.assign({},td,{fontWeight:700,color:p.overtime>0.05?C.ok:p.overtime<-0.05?C.gap:C.muted})},(p.overtime>0?"+":"")+round(p.overtime)+" h"),
            React.createElement("td",{style:Object.assign({},td,{padding:3,textAlign:"left"})},editable?React.createElement("textarea",{value:p.note||"",onChange:function(e){setNote(p.id,e.target.value);e.target.style.height="auto";e.target.style.height=e.target.scrollHeight+"px";},placeholder:"—",rows:1,style:Object.assign({},txtInput,{width:"100%",minWidth:160,resize:"none",overflow:"hidden",lineHeight:"1.4",boxSizing:"border-box"})})
              :React.createElement("span",{style:{color:C.muted}},p.note))
          );
        }))
      )
    )
  );
}

/* ================================================================== */
function Next8View(props){
  var state=props.state,sm=props.sm,viewerPid=props.viewerPid,editable=props.editable;
  var ci=currentWeekIndex();
  var win=WEEKS.slice(ci,ci+8);
  var team=state.team.filter(function(p){return p.active;});
  var fArr=useState(editable?"all":viewerPid||"all"); var filter=fArr[0],setFilter=fArr[1];
  var list=filter==="all"?team:team.filter(function(p){return p.id===filter;});
  function cellText(k,pid,d){var ab=absCodeForCell(state.absences||[],pid,k,d);var c=ab||cellCode(state,k,pid,d);var s=sm[c];if(!s)return"—";if(s.work)return s.time||s.hours+"h";return s.code;}
  return React.createElement("section",null,
    React.createElement(Eyebrow,null,"Next 8 weeks from today"),
    React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,margin:"4px 0 16px"}},
      React.createElement("h2",{style:{margin:0,fontSize:19,fontWeight:700}},"Who works when"),
      editable&&React.createElement("select",{value:filter,onChange:function(e){setFilter(e.target.value);},style:selStyle},React.createElement("option",{value:"all"},"Everyone"),team.map(function(p){return React.createElement("option",{key:p.id,value:p.id},p.name);}))
    ),
    React.createElement("div",{style:{display:"grid",gap:14}},
      list.map(function(p){
        return React.createElement("div",{key:p.id,style:{background:C.surface,border:"1px solid "+C.line,borderRadius:12,overflow:"hidden"}},
          React.createElement("div",{style:{padding:"10px 14px",borderBottom:"1px solid "+C.lineSoft,display:"flex",alignItems:"center",gap:8}},React.createElement("b",null,p.name),(p.qualifications||[]).map(function(q){return React.createElement(Pill,{key:q,tone:"neutral"},q);})),
          React.createElement("div",{style:{overflowX:"auto"}},
            React.createElement("table",{style:{borderCollapse:"collapse",width:"100%",minWidth:560,fontSize:13}},
              React.createElement("thead",null,React.createElement("tr",{style:{background:C.lineSoft}},React.createElement("th",{style:Object.assign({},th,{textAlign:"left"})},"Week"),DAYS.map(function(d){return React.createElement("th",{key:d,style:th},d);}))),
              React.createElement("tbody",null,win.map(function(w){
                var pub=weekData(state,w.key).published;
                return React.createElement("tr",{key:w.key,style:{borderTop:"1px solid "+C.lineSoft}},
                  React.createElement("td",{style:Object.assign({},td,{textAlign:"left",whiteSpace:"nowrap"})},w.kw," ",React.createElement("span",{style:{color:C.faint,fontSize:11}},w.range),!pub&&React.createElement("span",{style:{color:C.tight,fontSize:10,marginLeft:6}},"draft")),
                  DAYS.map(function(d){var ab=absCodeForCell(state.absences||[],p.id,w.key,d);var c=ab||cellCode(state,w.key,p.id,d);var s=sm[c];return React.createElement("td",{key:d,style:Object.assign({},td,{color:!s?C.faint:s.work?C.ink:s.vacation?C.ok:s.sick?C.gap:C.muted,fontWeight:s&&s.work?600:400,fontSize:12.5,whiteSpace:"nowrap"})},cellText(w.key,p.id,d));})
                );
              }))
            )
          )
        );
      })
    )
  );
}

/* ================================================================== */
const AV_OPTS=[["full","Full"],["am","AM"],["pm","PM"],["off","Off"]];
function AdminView(props){
  var state=props.state,effectiveRoleId=props.effectiveRoleId,userId=props.userId;
  var profilesArr=useState(null); var profiles=profilesArr[0],setProfiles=profilesArr[1];
  var loadErrArr=useState(null); var loadErr=loadErrArr[0],setLoadErr=loadErrArr[1];
  var savingArr=useState({}); var saving=savingArr[0],setSaving=savingArr[1];

  function reload(){
    setLoadErr(null);
    supabase.from("profiles").select("*").order("email").then(function(res){
      if(res.error){console.warn("profiles load failed:",res.error);setLoadErr("Could not load profiles.");return;}
      setProfiles(res.data||[]);
    }).catch(function(e){console.warn("profiles load failed:",e);setLoadErr("Could not load profiles.");});
  }
  useEffect(function(){reload();},[]);

  function saveRow(row,changes){
    var uid=row.user_id;
    setSaving(function(s){var n=Object.assign({},s);n[uid]="saving";return n;});
    supabase.from("profiles").update(changes).eq("user_id",uid).select().single().then(function(res){
      if(res.error){
        console.warn("profile update failed:",res.error);
        setSaving(function(s){var n=Object.assign({},s);n[uid]="error";return n;});
        return;
      }
      setSaving(function(s){var n=Object.assign({},s);n[uid]="saved";return n;});
      setProfiles(function(list){return list.map(function(p){return p.user_id===uid?res.data:p;});});
    }).catch(function(e){
      console.warn("profile update failed:",e);
      setSaving(function(s){var n=Object.assign({},s);n[uid]="error";return n;});
    });
  }

  function requestRoleChange(row,newRole){
    var ok=window.confirm("Change "+row.email+"'s role to \""+newRole+"\"?");
    if(!ok)return;
    saveRow(row,{role_id:newRole});
  }
  function requestActiveChange(row,newActive){
    if(newActive===false){
      var ok=window.confirm("Deactivate "+row.email+"? They will lose access immediately.");
      if(!ok)return;
    }
    saveRow(row,{active:newActive});
  }

  if(loadErr){
    return React.createElement("div",{style:{color:C.gap}},loadErr,React.createElement("div",{style:{marginTop:8}},React.createElement("button",{onClick:reload,style:btnStyle},"Retry")));
  }
  if(!profiles){
    return React.createElement("div",{style:{color:C.muted}},"Loading profiles...");
  }

  var roleOptions=effectiveRoleId==="dev"
    ? [["dev","Dev"],["admin","Admin"],["dienstplan","Dienstplan"],["leitung","Leitung"],["ed_team","ED Team"],["team","Team"]]
    : [["admin","Admin"],["dienstplan","Dienstplan"],["leitung","Leitung"],["ed_team","ED Team"],["team","Team"]];

  return React.createElement("div",null,
    React.createElement(Eyebrow,null,"Admin"),
    React.createElement("h2",{style:{margin:"4px 0 8px",fontSize:19,fontWeight:700}},"User profiles"),
    React.createElement("div",{style:{fontSize:12.5,color:C.muted,marginBottom:14,maxWidth:640}},
      "New accounts are still created directly in Supabase Auth, with the profile row added manually by SQL. This screen manages role, linked team member, and active status for people already set up."
    ),
    React.createElement("div",{style:{overflowX:"auto"}},
    React.createElement("table",{style:{width:"100%",borderCollapse:"collapse",minWidth:640}},
      React.createElement("thead",null,React.createElement("tr",null,
        React.createElement("th",{style:Object.assign({},th,{textAlign:"left"})},"Email"),
        React.createElement("th",{style:th},"Role"),
        React.createElement("th",{style:th},"Linked team member"),
        React.createElement("th",{style:th},"Active"),
        React.createElement("th",{style:th},"Status")
      )),
      React.createElement("tbody",null,
        profiles.map(function(row){
          var isSelf=row.user_id===userId;
          var devLocked=row.role_id==="dev"&&effectiveRoleId!=="dev";
          var roleLocked=devLocked||isSelf;
          var activeLocked=devLocked||isSelf;
          return React.createElement("tr",{key:row.user_id,style:{borderTop:"1px solid "+C.lineSoft}},
            React.createElement("td",{style:Object.assign({},td,{textAlign:"left"})},row.email,isSelf&&React.createElement("span",{style:{color:C.faint,fontSize:11}}," (you)")),
            React.createElement("td",{style:td},
              devLocked
                ? React.createElement("span",{style:{color:C.faint}},row.role_id)
                : React.createElement("select",{value:row.role_id,disabled:roleLocked,onChange:function(e){requestRoleChange(row,e.target.value);},style:selStyle},
                    roleOptions.map(function(o){return React.createElement("option",{key:o[0],value:o[0]},o[1]);})
                  )
            ),
            React.createElement("td",{style:td},
              React.createElement("select",{value:row.person_id||"",disabled:devLocked,onChange:function(e){saveRow(row,{person_id:e.target.value||null});},style:selStyle},
                React.createElement("option",{value:""},"— not linked —"),
                state.team.map(function(p){return React.createElement("option",{key:p.id,value:p.id},p.name);})
              )
            ),
            React.createElement("td",{style:td},
              React.createElement("input",{type:"checkbox",disabled:activeLocked,checked:!!row.active,onChange:function(e){requestActiveChange(row,e.target.checked);}})
            ),
            React.createElement("td",{style:Object.assign({},td,{color:saving[row.user_id]==="error"?C.gap:C.faint,fontSize:11.5})},
              saving[row.user_id]==="saving"?"Saving...":saving[row.user_id]==="saved"?"Saved":saving[row.user_id]==="error"?"Error":(devLocked?"Dev — locked":isSelf?"Your own account":"")
            )
          );
        })
      )
    )
    )
  );
}

function DevView(props){
  var onPermsChange=props.onPermsChange;
  var permsArr=useState(null); var perms=permsArr[0],setPerms=permsArr[1];
  var loadErrArr=useState(null); var loadErr=loadErrArr[0],setLoadErr=loadErrArr[1];
  var savingArr=useState({}); var saving=savingArr[0],setSaving=savingArr[1];

  function reload(){
    setLoadErr(null);
    supabase.from("role_permissions").select("*").then(function(res){
      if(res.error){console.warn("role_permissions load failed:",res.error);setLoadErr("Could not load permissions.");return;}
      setPerms(res.data||[]);
    }).catch(function(e){console.warn("role_permissions load failed:",e);setLoadErr("Could not load permissions.");});
  }
  useEffect(function(){reload();},[]);

  function findPerm(list,roleId,sectionId){
    return list.find(function(r){return r.role_id===roleId&&r.section_id===sectionId;});
  }

  // Dev and Admin sections are privileged: their access is fixed, not configurable.
  function getCell(roleId,sectionId){
    if(sectionId==="dev"){
      if(roleId==="dev")return {canView:true,canEdit:true,locked:true};
      return {canView:false,canEdit:false,locked:true};
    }
    if(sectionId==="admin"){
      if(roleId==="dev"||roleId==="admin")return {canView:true,canEdit:true,locked:true};
      return {canView:false,canEdit:false,locked:true};
    }
    var p=findPerm(perms,roleId,sectionId);
    return {canView:p?p.can_view:false,canEdit:p?p.can_edit:false,locked:false};
  }

  function applyChange(roleId,sectionId,field,value){
    var cell=getCell(roleId,sectionId);
    if(cell.locked)return; // privileged sections never change through this screen
    var canView=cell.canView,canEdit=cell.canEdit;
    if(field==="can_view"){
      canView=value;
      if(!value)canEdit=false; // turning View off always turns Edit off too
    } else {
      canEdit=value;
      if(value)canView=true; // turning Edit on always turns View on too
      if(sectionId==="forecast")canEdit=false; // Coverage is never editable, no exceptions
    }
    var payload={role_id:roleId,section_id:sectionId,can_view:canView,can_edit:canEdit};
    var key=roleId+"|"+sectionId;
    setSaving(function(s){var n=Object.assign({},s);n[key]="saving";return n;});
    supabase.from("role_permissions").upsert(payload,{onConflict:"role_id,section_id"}).select().then(function(res){
      if(res.error){
        console.warn("role_permissions save failed:",res.error);
        setSaving(function(s){var n=Object.assign({},s);n[key]="error";return n;});
        return;
      }
      setSaving(function(s){var n=Object.assign({},s);n[key]="saved";return n;});
      setPerms(function(list){
        var found=false;
        var next=list.map(function(r){if(r.role_id===roleId&&r.section_id===sectionId){found=true;return payload;}return r;});
        if(!found)next=next.concat([payload]);
        return next;
      });
      if(onPermsChange)onPermsChange(roleId,sectionId,payload);
    }).catch(function(e){
      console.warn("role_permissions save failed:",e);
      setSaving(function(s){var n=Object.assign({},s);n[key]="error";return n;});
    });
  }

  if(loadErr){
    return React.createElement("div",{style:{color:C.gap}},loadErr,React.createElement("div",{style:{marginTop:8}},React.createElement("button",{onClick:reload,style:btnStyle},"Retry")));
  }
  if(!perms){
    return React.createElement("div",{style:{color:C.muted}},"Loading permissions...");
  }

  var roleIds=["dev","admin","dienstplan","leitung","ed_team","team"];

  return React.createElement("div",null,
    React.createElement(Eyebrow,null,"Dev"),
    React.createElement("h2",{style:{margin:"4px 0 4px",fontSize:19,fontWeight:700}},"Role permissions"),
    React.createElement("div",{style:{fontSize:12.5,color:C.muted,marginBottom:6,maxWidth:660}},
      "Controls which sections each role can see and edit. Coverage is always view-only for every role. The Admin and Dev columns' Admin/Dev rows are fixed and cannot be changed here — Dev always has full access to both; Admin always has full access to Admin only; every other role has none."
    ),
    React.createElement("div",{style:{overflowX:"auto"}},
    React.createElement("table",{style:{borderCollapse:"collapse",minWidth:780}},
      React.createElement("thead",null,
        React.createElement("tr",null,
          React.createElement("th",{style:th},"Section"),
          roleIds.map(function(r){return React.createElement("th",{key:r,style:th,colSpan:2},r);})
        ),
        React.createElement("tr",null,
          React.createElement("th",{style:th},""),
          roleIds.map(function(r){return [
            React.createElement("th",{key:r+"-v",style:Object.assign({},th,{fontSize:10,fontWeight:500})},"View"),
            React.createElement("th",{key:r+"-e",style:Object.assign({},th,{fontSize:10,fontWeight:500})},"Edit")
          ];})
        )
      ),
      React.createElement("tbody",null,
        ALL_SECTIONS.map(function(sec){
          var secId=sec[0],secLabel=sec[1];
          var coverageLock=secId==="forecast";
          return React.createElement("tr",{key:secId,style:{borderTop:"1px solid "+C.lineSoft}},
            React.createElement("td",{style:Object.assign({},td,{fontWeight:600,textAlign:"left"})},secLabel),
            roleIds.map(function(roleId){
              var cell=getCell(roleId,secId);
              var key=roleId+"|"+secId;
              var status=saving[key];
              var editDisabled=cell.locked||coverageLock||!cell.canView;
              return [
                React.createElement("td",{key:roleId+"-v",style:td},
                  React.createElement("input",{type:"checkbox",checked:cell.canView,disabled:cell.locked,onChange:function(e){applyChange(roleId,secId,"can_view",e.target.checked);}})
                ),
                React.createElement("td",{key:roleId+"-e",style:td},
                  React.createElement("input",{type:"checkbox",checked:cell.canEdit,disabled:editDisabled,onChange:function(e){applyChange(roleId,secId,"can_edit",e.target.checked);}}),
                  status&&React.createElement("div",{style:{fontSize:9.5,color:status==="error"?C.gap:C.faint,marginTop:2}},status==="saving"?"Saving...":status==="saved"?"Saved":"Error")
                )
              ];
            })
          );
        })
      )
    )
    ),
    React.createElement("h2",{style:{margin:"24px 0 8px",fontSize:19,fontWeight:700}},"App info"),
    React.createElement("div",{style:{fontSize:13,color:C.muted}},
      "Build: "+(APP_BUILD_TIME?formatBerlin(APP_BUILD_TIME):"unknown")
    )
  );
}

function SetupView(props){
  var state=props.state,update=props.update,editable=props.editable,setState=props.setState;
  var markNextSaveBulk=props.markNextSaveBulk,effectiveRoleId=props.effectiveRoleId;
  var isDevOrAdmin=effectiveRoleId==="dev"||effectiveRoleId==="admin";
  var ioArr=useState(false); var importOpen=ioArr[0],setImportOpen=ioArr[1];
  var snapArr=useState(null); var snapResult=snapArr[0],setSnapResult=snapArr[1];
  var snapConfArr=useState(false); var snapConfirm=snapConfArr[0],setSnapConfirm=snapConfArr[1];
  var itArr=useState(""); var importText=itArr[0],setImportText=itArr[1];
  var ciArr=useState(null); var confirmId=ciArr[0],setConfirmId=ciArr[1];
  var boArr=useState(false); var backupOpen=boArr[0],setBackupOpen=boArr[1];
  var pdArr=useState(""); var pasteData=pdArr[0],setPasteData=pdArr[1];
  var msgArr=useState(""); var msg=msgArr[0],setMsg=msgArr[1];

  function setP(id,f,v){update(function(s){var p=s.team.find(function(x){return x.id===id;});if(!p)return s;p[f]=f==="name"?v:(typeof v==="boolean"?v:Number(v));return s;});}
  function setAvail(id,d,v){update(function(s){var p=s.team.find(function(x){return x.id===id;});if(p)p.availability=Object.assign({},p.availability||{},{[d]:v});return s;});}
  function setQual(id,v){update(function(s){var p=s.team.find(function(x){return x.id===id;});if(p)p.qualifications=v.split(",").map(function(q){return q.trim();}).filter(Boolean);return s;});}
  function setMin(v){update(function(s){s.settings.defaultMin=Number(v);return s;});}
  function setSett(f,v){update(function(s){var cur=Object.assign({},s.settings);cur[f]=Number(v)||0;s.settings=cur;return s;});}
  function setBackup(d,v){update(function(s){s.settings.backupByDay=Object.assign({},s.settings.backupByDay||{},{[d]:v});return s;});}
  function addPerson(){update(function(s){var np=mkPerson("New team member",0,0);np.id="p-"+Date.now();s.team.push(np);return s;});}
  function removePerson(id){update(function(s){s.team=s.team.filter(function(x){return x.id!==id;});return s;});setConfirmId(null);}
  function setSpringerHours(id,f,v){update(function(s){var p=s.team.find(function(x){return x.id===id;});if(p)p[f]=Number(v)||0;return s;});}
  function runImport(){
    var lines=importText.split("\n").map(function(l){return l.trim();}).filter(Boolean);
    update(function(s){lines.forEach(function(l){var parts=l.split(/[;,\t]/).map(function(x){return x&&x.trim();});var name=parts[0],h=parts[1],d=parts[2];if(name){var np=mkPerson(name,Number(h)||0,Number(d)||0);np.id="p-"+Date.now()+"-"+Math.random().toString(36).slice(2,6);s.team.push(np);}});return s;});
    setImportText("");setImportOpen(false);
  }
  function createLocalStateBackup(label){
    var backupKey="kita30-"+label+"-backup-"+Date.now();
    var backupData={
      team:state.team,
      shifts:state.shifts,
      weeks:state.weeks,
      settings:state.settings,
      absences:state.absences||[],
      timesheetLog:state.timesheetLog||[]
    };
    try{
      window.localStorage.setItem(backupKey,JSON.stringify(backupData));
      return backupKey;
    }catch(e){
      console.warn("local backup failed:",e);
      return null;
    }
  }
  function loadSnapshot(){
    if(!isDevOrAdmin){setMsg("Only Dev/Admin can load the snapshot.");return;}
    var backupKey=createLocalStateBackup("snapshot");
    if(!backupKey){
      setMsg("Snapshot cancelled because the local backup could not be created.");
      setSnapResult(null);
      return;
    }
    if(markNextSaveBulk)markNextSaveBulk("load_snapshot");
    // Build week data from snapshot rows
    var DAYS_ORDER=["Mon","Tue","Wed","Thu","Fri"];
    var report={weeksImported:0,shiftsAdded:[],absencesAdded:0,normalShifts:0,skipped:0,warnings:[],backupKey:backupKey};
    // Ensure missing shifts exist
    var shiftsToAdd=["Limpieza","Cocina","FFU"];
    shiftsToAdd.forEach(function(code){
      if(!state.shifts.find(function(s){return s.code===code;})){
        report.shiftsAdded.push(code);
      }
    });
    setState(function(prev){
      var next=JSON.parse(JSON.stringify(prev));
      // Add missing shifts
      var shiftDefs=[
        {code:"Limpieza",label:"Limpieza (cleaning)",time:"xx:xx-xx:xx",start:null,end:null,hours:4,work:true},
        {code:"Cocina",  label:"Cocina (kitchen)",   time:"xx:xx-xx:xx",start:null,end:null,hours:3,work:true},
        {code:"FFU",     label:"Freizeitausgleich",  time:"",           start:null,end:null,hours:0,work:false,absence:true}
      ];
      shiftDefs.forEach(function(def){
        if(!next.shifts.find(function(s){return s.code===def.code;})){
          next.shifts.push(def);
        }
      });
      // Remove previous snapshot-generated absences for these three weeks once.
      var snapshotWeekKeys={"2026-KW25":true,"2026-KW26":true,"2026-KW27":true};
      next.absences=(next.absences||[]).filter(function(a){
        return !(a&&a.source==="snapshot_sheets"&&snapshotWeekKeys[isoWeekKey(a.date)]);
      });
      // Build person lookup by name (trimmed)
      var personByName={};
      next.team.forEach(function(p){personByName[p.name.trim()]=p;});
      // Process each snapshot week
      Object.keys(SNAPSHOT_KW25_27.weeks).forEach(function(weekKey){
        var wSnap=SNAPSHOT_KW25_27.weeks[weekKey];
        var newWeek={assign:{},notes:{},adj:{},minOverride:{},u3Override:{},over3Override:{},
                     backupByDay:{},customShifts:{},confirmed:false,published:false};
        var absToAdd=[];
        // Find week dates
        var kwIdx=parseInt(weekKey.split("KW")[1],10)-1;
        var weekStart=new Date(2025,11,29);
        weekStart.setDate(weekStart.getDate()+kwIdx*7);
        wSnap.rows.forEach(function(row){
          var p=personByName[row.name]||personByName[(row.name||"").trim()];
          if(!p){report.warnings.push("Person not found: "+row.name);return;}
          newWeek.assign[p.id]={};
          DAYS_ORDER.forEach(function(d,di){
            var raw=row[d];
            if(!raw||raw===null){return;}
            // Map to app shift code
            var mapped=SNAPSHOT_KW25_27.shiftMap[raw]||raw;
            var shiftDef=next.shifts.find(function(s){return s.code===mapped;});
            if(!shiftDef){
              // Unknown code - skip with warning
              report.warnings.push("Unknown shift code: "+raw+" for "+row.name+" "+weekKey+" "+d);
              report.skipped++;
              return;
            }
            if(shiftDef.absence){
              // Record as absence
              var dayOffset={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4}[d];
              var absDate=new Date(weekStart);
              absDate.setDate(weekStart.getDate()+dayOffset);
              var isoDate=absDate.getFullYear()+"-"+String(absDate.getMonth()+1).padStart(2,"0")+"-"+String(absDate.getDate()).padStart(2,"0");
              var autoApply=(mapped==="Sick"||mapped==="Sick-K"||mapped==="Holiday"||mapped==="FFU");
              absToAdd.push({id:"snap-"+weekKey+"-"+p.id+"-"+d,pid:p.id,date:isoDate,code:mapped,
                status:autoApply?"approved":"pending",createdAt:"2026-06-18",
                lateNotice:mapped==="Vacation",source:"snapshot_sheets"});
              report.absencesAdded++;
            } else {
              newWeek.assign[p.id][d]=mapped;
              report.normalShifts++;
            }
            // Handle per-day adj
            var deltaKey=d.toLowerCase()+"Delta";
            if(row[deltaKey]!=null&&row[deltaKey]!==0){
              if(!newWeek.adj[p.id]) newWeek.adj[p.id]=0;
              // Store note about adjustment
              var adjNote="adj "+row[deltaKey]+"h (imported from Sheets)";
              if(!newWeek.notes[p.id]) newWeek.notes[p.id]="";
              if(newWeek.notes[p.id]) newWeek.notes[p.id]+=" | ";
              newWeek.notes[p.id]+=adjNote;
            }
          });
          // Remove empty assign
          if(Object.keys(newWeek.assign[p.id]).length===0) delete newWeek.assign[p.id];
        });
        // Add day notes
        if(wSnap.dayNotes){
          DAYS_ORDER.forEach(function(d){
            if(wSnap.dayNotes[d]){
              // Store day notes in a special key
              if(!newWeek.notes["_day_"+d]) newWeek.notes["_day_"+d]="";
              newWeek.notes["_day_"+d]=wSnap.dayNotes[d];
            }
          });
        }
        next.weeks[weekKey]=newWeek;
        // Add the snapshot absences for this week.
        next.absences=next.absences.concat(absToAdd);
        report.weeksImported++;
      });
      return next;
    });
    setSnapResult(report);
    setSnapConfirm(false);
  }
  var exportJSON=JSON.stringify({team:state.team,shifts:state.shifts,weeks:state.weeks,settings:state.settings,absences:state.absences||[],timesheetLog:state.timesheetLog||[]},null,2);
  function download(){try{var blob=new Blob([exportJSON],{type:"application/json"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download="kita-dienstplan-data.json";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}catch(e){setMsg("Download blocked — copy instead.");}}
  function copy(){try{navigator.clipboard.writeText(exportJSON);setMsg("Copied.");}catch(e){setMsg("Copy blocked — select manually.");}}
  function applyImport(text){
    if(!isDevOrAdmin){setMsg("Only Dev/Admin can import data.");return;}
    var o=null;
    try{
      o=JSON.parse(text);
    }catch(e){
      setMsg("Could not parse JSON.");
      return;
    }
    var validationError=validateImportedStatePayload(o);
    if(validationError){setMsg(validationError);return;}
    var ok=window.confirm("This will replace the current team, shifts, weeks, absences and timesheet data with the imported file. Continue?");
    if(!ok)return;
    var backupKey=createLocalStateBackup("json-import");
    if(!backupKey){
      setMsg("Import cancelled because the local backup could not be created.");
      return;
    }
    if(markNextSaveBulk)markNextSaveBulk("json_import");
    setState(normalizeImportedStatePayload(o));
    setMsg("Data loaded. Local backup: "+backupKey);
    setPasteData("");
  }
  function onFile(e){var f=e.target.files&&e.target.files[0];if(!f)return;f.text().then(applyImport).catch(function(){setMsg("Could not read the selected file.");});}

  return React.createElement("section",{style:{display:"grid",gap:22}},
    React.createElement("div",null,
      React.createElement(Eyebrow,null,"Shift types & absence types"),
      React.createElement("div",{style:{background:C.surface,border:"1px solid "+C.line,borderRadius:12,overflow:"hidden",overflowX:"auto",marginTop:10,marginBottom:18}},
        React.createElement("table",{style:{borderCollapse:"collapse",width:"100%",minWidth:820,fontSize:12.5}},
          React.createElement("thead",null,
            React.createElement("tr",{style:{background:C.lineSoft}},
              React.createElement("th",{style:Object.assign({},th,{textAlign:"left"})}," Code"),
              React.createElement("th",{style:Object.assign({},th,{textAlign:"left"})}," Label"),
              React.createElement("th",{style:th},"Start"),React.createElement("th",{style:th},"End"),React.createElement("th",{style:th},"Hours"),
              React.createElement("th",{style:th},"Work"),React.createElement("th",{style:th},"Absence"),React.createElement("th",{style:th},"Sick"),React.createElement("th",{style:th},"Vac"),React.createElement("th",{style:th},"Holiday"),
              editable&&React.createElement("th",{style:th},"Del")
            )
          ),
          React.createElement("tbody",null,
            state.shifts.map(function(s){
              return React.createElement("tr",{key:s.code,style:{borderTop:"1px solid "+C.lineSoft}},
                React.createElement("td",{style:Object.assign({},td,{textAlign:"left"})},
                  editable?React.createElement("input",{value:s.code,onChange:function(e){update(function(st){var sh=st.shifts.find(function(x){return x.code===s.code;});if(sh)sh.code=e.target.value;return st;});},style:Object.assign({},txtInput,{width:70,fontWeight:700})})
                    :React.createElement("b",null,s.code)
                ),
                React.createElement("td",{style:Object.assign({},td,{textAlign:"left"})},
                  editable?React.createElement("input",{value:s.label||"",onChange:function(e){update(function(st){var sh=st.shifts.find(function(x){return x.code===s.code;});if(sh)sh.label=e.target.value;return st;});},style:Object.assign({},txtInput,{width:160})})
                    :React.createElement("span",{style:{color:C.muted}},s.label)
                ),
                React.createElement("td",{style:td},
                  editable?React.createElement("input",{type:"number",step:"0.5",value:s.start!=null?s.start:"",placeholder:"—",onChange:function(e){update(function(st){var sh=st.shifts.find(function(x){return x.code===s.code;});if(sh)sh.start=e.target.value===""?null:Number(e.target.value);return st;});},style:Object.assign({},numInput,{width:52})})
                    :React.createElement("span",null,s.start!=null?hToHMS(s.start):"—")
                ),
                React.createElement("td",{style:td},
                  editable?React.createElement("input",{type:"number",step:"0.5",value:s.end!=null?s.end:"",placeholder:"—",onChange:function(e){update(function(st){var sh=st.shifts.find(function(x){return x.code===s.code;});if(sh)sh.end=e.target.value===""?null:Number(e.target.value);return st;});},style:Object.assign({},numInput,{width:52})})
                    :React.createElement("span",null,s.end!=null?hToHMS(s.end):"—")
                ),
                React.createElement("td",{style:td},
                  editable?React.createElement("input",{type:"number",step:"0.5",value:s.hours||0,onChange:function(e){update(function(st){var sh=st.shifts.find(function(x){return x.code===s.code;});if(sh)sh.hours=Number(e.target.value)||0;return st;});},style:Object.assign({},numInput,{width:46})})
                    :React.createElement("span",null,s.hours||0)
                ),
                ["work","absence","sick","vacation","holiday"].map(function(f){
                  return React.createElement("td",{key:f,style:td},
                    React.createElement("input",{type:"checkbox",disabled:!editable,checked:!!s[f],onChange:function(e){update(function(st){var sh=st.shifts.find(function(x){return x.code===s.code;});if(sh)sh[f]=e.target.checked;return st;});}})
                  );
                }),
                editable&&React.createElement("td",{style:td},
                  React.createElement("button",{onClick:function(){if(window.confirm("Remove shift type "+s.code+"?")){update(function(st){st.shifts=st.shifts.filter(function(x){return x.code!==s.code;});return st;});}},style:Object.assign({},miniBtn,{color:C.faint})},"×")
                )
              );
            }),
            editable&&React.createElement("tr",{style:{borderTop:"1px solid "+C.line}},
              React.createElement("td",{colSpan:11,style:{padding:8,textAlign:"center"}},
                React.createElement("button",{onClick:function(){update(function(st){st.shifts.push({code:"NEW",label:"New shift",start:null,end:null,hours:0,work:true,absence:false,sick:false,vacation:false,holiday:false});return st;});},style:Object.assign({},miniBtn,{color:C.primary,fontWeight:700})},"+ Add shift type")
              )
            )
          )
        )
      ),
      React.createElement(Eyebrow,null,"Coverage rules"),
      React.createElement("div",{style:{background:C.surface,border:"1px solid "+C.line,borderRadius:12,padding:"14px 16px",marginTop:10,display:"grid",gap:14}},
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}},
          React.createElement("label",{style:{fontSize:13,color:C.muted,fontWeight:600,minWidth:220}},"Fallback minimum staff per day"),
          editable?React.createElement("input",{type:"number",min:"0",value:state.settings.defaultMin,onChange:function(e){setMin(e.target.value);},style:Object.assign({},numInput,{width:56})}):React.createElement("span",null,state.settings.defaultMin),
          React.createElement("span",{style:{fontSize:12,color:C.faint}},"Used when U3/3+ calc is not set for a specific day.")
        ),
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}},
          [
            ["u3Default","U3 children (default per day)","10"],
            ["over3Default","3+ children (default per day)","20"],
            ["u3Ratio","U3 ratio — children per educator","4"],
            ["over3Ratio","3+ ratio — children per educator","9"]
          ].map(function(row){
            var field=row[0],label=row[1],placeholder=row[2];
            return React.createElement("label",{key:field,style:{display:"flex",flexDirection:"column",gap:4,fontSize:12,color:C.muted,fontWeight:600}},
              label,
              editable?React.createElement("input",{type:"number",min:"1",value:state.settings[field]||"",placeholder:placeholder,onChange:function(e){setSett(field,e.target.value);},style:Object.assign({},numInput,{width:"100%"})}):React.createElement("span",{style:{fontWeight:700,color:C.ink}},state.settings[field]||placeholder)
            );
          })
        ),
        React.createElement("div",{style:{fontSize:11.5,color:C.faint}},"Required educators = ceil(U3 / U3 ratio) + ceil(3+ / 3+ ratio). This is an internal coverage rule — not a legal compliance calculation. Each day in the Weekly Plan can still be adjusted manually.")
      )
    ),
    
    /* Springer hours */
    
    React.createElement("div",null,
      React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}},
        React.createElement(Eyebrow,null,"Team — contract, roles, availability & qualifications"),
        editable&&React.createElement("div",{style:{display:"flex",gap:8}},
          React.createElement("button",{onClick:function(){setImportOpen(function(o){return !o;});},style:Object.assign({},btnStyle,{padding:"7px 12px",fontSize:13})},"Import"),
          React.createElement("button",{onClick:addPerson,style:Object.assign({},btnStyle,{padding:"7px 12px",fontSize:13,background:C.primary,color:"#fff",borderColor:C.primary})},"+ Add person")
        )
      ),
      importOpen&&editable&&React.createElement("div",{style:{background:C.surface,border:"1px solid "+C.line,borderRadius:12,padding:14,marginTop:10}},
        React.createElement("div",{style:{fontSize:13,color:C.muted,marginBottom:8}},"One per line: ",React.createElement("code",null,"Name; weekly hours; days")),
        React.createElement("textarea",{value:importText,onChange:function(e){setImportText(e.target.value);},rows:3,style:{width:"100%",fontFamily:FONT,fontSize:13,padding:10,borderRadius:8,border:"1px solid "+C.line,boxSizing:"border-box"},placeholder:"Lina; 20; 4"}),
        React.createElement("div",{style:{marginTop:8}},React.createElement("button",{onClick:runImport,style:Object.assign({},btnStyle,{background:C.primary,color:"#fff",borderColor:C.primary})},"Add to team"))
      ),
      React.createElement("div",{style:{background:C.surface,border:"1px solid "+C.line,borderRadius:12,overflow:"hidden",overflowX:"auto",marginTop:10}},
        React.createElement("table",{style:{borderCollapse:"collapse",width:"100%",minWidth:1100,fontSize:12.5}},
          React.createElement("thead",null,React.createElement("tr",{style:{background:C.lineSoft}},
            React.createElement("th",{style:Object.assign({},th,{textAlign:"left"})},"Name"),React.createElement("th",{style:th},"h/wk"),React.createElement("th",{style:th},"Days"),React.createElement("th",{style:th},"TS"),React.createElement("th",{style:th},"Vac/yr"),React.createElement("th",{style:th},"Kids"),React.createElement("th",{style:th},"Kitchen"),React.createElement("th",{style:th},"Cleaning"),React.createElement("th",{style:th},"Springer"),React.createElement("th",{style:th},"Eltern"),React.createElement("th",{style:th},"Active"),React.createElement("th",{style:th},"Spr.h limit"),
            DAYS.map(function(d){return React.createElement("th",{key:d,style:Object.assign({},th,{borderLeft:d==="Mon"?"2px solid "+C.line:"none"})},d);}),
            React.createElement("th",{style:Object.assign({},th,{textAlign:"left",borderLeft:"2px solid "+C.line})},"Qualifications"),
            editable&&React.createElement("th",{style:th})
          )),
          React.createElement("tbody",null,state.team.map(function(p){
            return React.createElement("tr",{key:p.id,style:{borderTop:"1px solid "+C.lineSoft}},
              React.createElement("td",{style:Object.assign({},td,{textAlign:"left"})},editable?React.createElement("input",{value:p.name,onChange:function(e){setP(p.id,"name",e.target.value);},style:Object.assign({},txtInput,{width:120})}):p.name),
              React.createElement("td",{style:td},editable?React.createElement("input",{type:"number",value:p.weeklyHours,onChange:function(e){setP(p.id,"weeklyHours",e.target.value);},style:numInput}):p.weeklyHours),
              React.createElement("td",{style:td},editable?React.createElement("input",{type:"number",value:p.daysPerWeek,onChange:function(e){setP(p.id,"daysPerWeek",e.target.value);},style:numInput}):p.daysPerWeek),
              React.createElement("td",{style:td},editable?React.createElement("input",{type:"number",step:"0.5",value:p.tsHours,onChange:function(e){setP(p.id,"tsHours",e.target.value);},style:numInput}):p.tsHours),
              React.createElement("td",{style:td},editable?React.createElement("input",{type:"number",value:p.vacationAllowance,onChange:function(e){setP(p.id,"vacationAllowance",e.target.value);},style:numInput}):p.vacationAllowance),
              React.createElement("td",{style:td},React.createElement("input",{type:"checkbox",disabled:!editable,checked:!!p.coverage,onChange:function(e){setP(p.id,"coverage",e.target.checked);}})),
              React.createElement("td",{style:td},React.createElement("input",{type:"checkbox",disabled:!editable,checked:!!p.kitchen,onChange:function(e){setP(p.id,"kitchen",e.target.checked);}})),
              React.createElement("td",{style:td},React.createElement("input",{type:"checkbox",disabled:!editable,checked:!!p.cleaning,onChange:function(e){setP(p.id,"cleaning",e.target.checked);}})),
              React.createElement("td",{style:td},React.createElement("input",{type:"checkbox",disabled:!editable,checked:!!p.springer,onChange:function(e){setP(p.id,"springer",e.target.checked);}})),
              React.createElement("td",{style:td},React.createElement("input",{type:"checkbox",disabled:!editable,checked:!!p.eltern,onChange:function(e){setP(p.id,"eltern",e.target.checked);}})),
              React.createElement("td",{style:td},React.createElement("input",{type:"checkbox",disabled:!editable,checked:!!p.active,onChange:function(e){setP(p.id,"active",e.target.checked);}}))
                ,React.createElement("td",{style:td},p.springer?(editable?React.createElement("input",{type:"number",min:"0",value:p.springerHoursLimit||0,onChange:function(e){setP(p.id,"springerHoursLimit",e.target.value);},style:numInput}):String(p.springerHoursLimit||0)):React.createElement("span",{style:{color:C.faint}},"-")),
              DAYS.map(function(d){return React.createElement("td",{key:d,style:Object.assign({},td,{padding:3,borderLeft:d==="Mon"?"2px solid "+C.line:"none"})},editable?React.createElement("select",{value:availVal(p,d),onChange:function(e){setAvail(p.id,d,e.target.value);},style:Object.assign({},cellSel,{width:60,fontWeight:500})},AV_OPTS.map(function(vl){return React.createElement("option",{key:vl[0],value:vl[0]},vl[1]);})):React.createElement("span",null,(AV_OPTS.find(function(vl){return vl[0]===availVal(p,d);})||AV_OPTS[0])[1]));}),
              React.createElement("td",{style:Object.assign({},td,{textAlign:"left",padding:3,borderLeft:"2px solid "+C.line})},editable?React.createElement("input",{value:(p.qualifications||[]).join(", "),onChange:function(e){setQual(p.id,e.target.value);},placeholder:"Fachkraft, …",style:Object.assign({},txtInput,{width:"100%",minWidth:120})})
                :React.createElement("span",{style:{display:"flex",gap:4,flexWrap:"wrap"}},(p.qualifications||[]).map(function(q){return React.createElement(Pill,{key:q,tone:"neutral"},q);}))),
              editable&&React.createElement("td",{style:td},confirmId===p.id?React.createElement("span",null,React.createElement("button",{onClick:function(){removePerson(p.id);},style:Object.assign({},miniBtn,{color:C.gap})},"yes"),React.createElement("button",{onClick:function(){setConfirmId(null);},style:Object.assign({},miniBtn,{color:C.muted})},"no"))
                :React.createElement("button",{onClick:function(){setConfirmId(p.id);},style:Object.assign({},miniBtn,{color:C.faint})},"✕"))
            );
          }))
        )
      )
    ),
    editable&&React.createElement("div",null,
      React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"}},
        React.createElement(Eyebrow,null,"Backup & transfer"),
        editable&&isDevOrAdmin&&React.createElement("div",{style:{marginBottom:12,background:C.primarySoft,border:"1px solid "+C.primary+"33",borderRadius:10,padding:"12px 14px"}},
          React.createElement("div",{style:{fontWeight:700,fontSize:14,marginBottom:4,color:C.primaryDark}},"Load Kita Snapshot (KW25–KW27)"),
          React.createElement("p",{style:{fontSize:12.5,color:C.muted,margin:"0 0 10px"}},"Loads real schedule data for KW25 (16.06), KW26 (22.06) and KW27 (29.06) from the Dienstplan 2026 Google Sheets snapshot. Current data for these weeks will be replaced. A local backup will be saved before loading."),
          !snapConfirm&&React.createElement("button",{onClick:function(){setSnapConfirm(true);setSnapResult(null);},style:Object.assign({},btnStyle,{background:C.primary,color:"#fff",borderColor:C.primary})},"Load snapshot…"),
          snapConfirm&&React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:8}},
            React.createElement("div",{style:{fontSize:13,color:C.gap,fontWeight:600,padding:"8px 0"}},"This will replace Weekly Plan data for KW25, KW26 and KW27. A local backup will be saved automatically. Continue?"),
            React.createElement("div",{style:{display:"flex",gap:8}},
              React.createElement("button",{onClick:loadSnapshot,style:Object.assign({},btnStyle,{background:C.gap,color:"#fff",borderColor:C.gap})},"Yes, load snapshot"),
              React.createElement("button",{onClick:function(){setSnapConfirm(false);},style:btnStyle},"Cancel")
            )
          ),
          snapResult&&React.createElement("div",{style:{marginTop:12,background:C.surface,border:"1px solid "+C.line,borderRadius:8,padding:"10px 12px",fontSize:12.5}},
            React.createElement("div",{style:{fontWeight:700,marginBottom:6,color:C.ok}},"Import complete"),
            React.createElement("div",null,"✓ Weeks imported: ",React.createElement("b",null,snapResult.weeksImported)),
            React.createElement("div",null,"✓ Normal shifts: ",React.createElement("b",null,snapResult.normalShifts)),
            React.createElement("div",null,"✓ Absences added: ",React.createElement("b",null,snapResult.absencesAdded)),
            React.createElement("div",null,"✓ Local backup: ",React.createElement("code",null,snapResult.backupKey)),
            snapResult.shiftsAdded.length>0&&React.createElement("div",null,"✓ Shift types added: ",React.createElement("b",null,snapResult.shiftsAdded.join(", "))),
            snapResult.skipped>0&&React.createElement("div",{style:{color:C.tight}},"⚠ Skipped (unknown codes): ",React.createElement("b",null,snapResult.skipped)),
            snapResult.warnings.length>0&&React.createElement("div",{style:{marginTop:6}},
              React.createElement("div",{style:{fontWeight:600,color:C.tight,marginBottom:3}},"Warnings:"),
              snapResult.warnings.map(function(w,i){return React.createElement("div",{key:i,style:{fontSize:11.5,color:C.tight}},w);})
            )
          )
        ),
        React.createElement("button",{onClick:function(){setBackupOpen(function(o){return !o;});},style:Object.assign({},btnStyle,{padding:"7px 12px",fontSize:13})},backupOpen?"Hide":"Open")
      ),
      backupOpen&&React.createElement("div",{style:{background:C.surface,border:"1px solid "+C.line,borderRadius:12,padding:16,marginTop:10,display:"grid",gap:16}},
        React.createElement("div",null,
          React.createElement("div",{style:{fontWeight:700,fontSize:14,marginBottom:4}},"Export"),
          React.createElement("p",{style:{fontSize:12.5,color:C.muted,margin:"0 0 10px"}},"Full state: team, schedule, absences, timesheets. Compatible with a future Google Sheets backend."),
          React.createElement("div",{style:{display:"flex",gap:8,marginBottom:8}},
            React.createElement("button",{onClick:download,style:Object.assign({},btnStyle,{background:C.primary,color:"#fff",borderColor:C.primary})},"Download JSON"),
            React.createElement("button",{onClick:copy,style:btnStyle},"Copy")
          ),
          React.createElement("textarea",{readOnly:true,value:exportJSON,rows:5,onFocus:function(e){e.target.select();},style:{width:"100%",fontFamily:"monospace",fontSize:11.5,padding:10,borderRadius:8,border:"1px solid "+C.line,boxSizing:"border-box",color:C.muted}})
        ),
        isDevOrAdmin&&React.createElement("div",null,
          React.createElement("div",{style:{fontWeight:700,fontSize:14,marginBottom:6}},"Import"),
          React.createElement("input",{type:"file",accept:"application/json",onChange:onFile,style:{fontSize:13,marginBottom:8}}),
          React.createElement("textarea",{value:pasteData,onChange:function(e){setPasteData(e.target.value);},rows:4,placeholder:"…or paste JSON here",style:{width:"100%",fontFamily:"monospace",fontSize:11.5,padding:10,borderRadius:8,border:"1px solid "+C.line,boxSizing:"border-box"}}),
          React.createElement("div",{style:{marginTop:8}},React.createElement("button",{onClick:function(){applyImport(pasteData);},style:Object.assign({},btnStyle,{background:C.primary,color:"#fff",borderColor:C.primary})},"Load data"))
        ),
        msg&&React.createElement("div",{style:{fontSize:13,color:C.primary,fontWeight:600}},msg)
      )
    )
  );
}
