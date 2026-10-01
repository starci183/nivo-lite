import { chromium } from "playwright";
const base="http://localhost:3090";
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1440,height:900}});
await ctx.addCookies([{name:"NIVO_LOCALE",value:process.env.L||"en",url:base}]);
const p=await ctx.newPage();
await p.goto(base+"/login");await p.getByRole("button",{name:/demo/i}).first().click({force:true});
await p.waitForURL(u=>!u.pathname.startsWith("/login"),{timeout:60000});
for (const path of process.argv.slice(2)){
await p.goto(base+path,{waitUntil:"networkidle"});await p.waitForTimeout(600);
const r=await p.evaluate(()=>[...document.querySelectorAll("textarea,input:not([type=hidden])")].map(e=>{
 const chain=[];let n=e;for(let i=0;i<4&&n;i++){chain.push(getComputedStyle(n).backgroundColor+"|"+n.className.toString().slice(0,50));n=n.parentElement}
 return e.tagName+":"+(e.name||e.id)+" "+chain.join(" <- ")+" inCard="+!!e.closest("[data-grammar-surface-card],[data-grammar-surface-depth],.starci-core-surface-card")}));
console.log(path);console.log(r.join("\n"));}
await b.close();
