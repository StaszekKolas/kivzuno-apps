"use strict";
(()=>{
  const label=document.getElementById("kivzuno-payment-status");
  const buy=document.getElementById("kivzuno-buy-film");
  if(!label || !buy)return;
  // Fail closed: no disabled button can redirect to a checkout.
  buy.disabled=true;
  async function check(){
    try{
      const res=await fetch("/.netlify/functions/lemon-readiness",{
        method:"POST",headers:{"content-type":"application/json"},
        credentials:"same-origin",body:JSON.stringify({action:"capabilities"})
      });
      if(!res.ok)throw new Error("unavailable");
      const data=await res.json();
      label.textContent=data.checkoutReady===true && data.paymentActive===true
        ?"Payment readiness requires a new verified deployment before checkout can be enabled."
        :"Payments are not live. Lemon Squeezy store activation and automatic film fulfillment must be completed before customers can buy. No payment will be taken.";
    }catch{
      label.textContent="Checkout unavailable. No purchase or charge can be made.";
    }
  }
  check();
})();
