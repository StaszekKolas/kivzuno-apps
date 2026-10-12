import {createHmac,timingSafeEqual} from "node:crypto";

// A verified merchant order is the ONLY future authorization for a billable film.
// This module is deliberately pure. It does not take money or mint delivery tokens.
const hex=/^[a-f0-9]{64}$/i;
export function validateLemonSignature(rawBody,signature,secret) {
  if(!secret || typeof rawBody!=="string" || typeof signature!=="string" || !hex.test(signature))return false;
  const expected=createHmac("sha256",secret).update(rawBody).digest("hex");
  return timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(signature.toLowerCase(),"hex"));
}
export function isPaidLemonOrder(payload,{storeId,variantId,allowTest=false}) {
  const order=payload?.data;
  const meta=payload?.meta;
  const attr=order?.attributes;
  if(meta?.event_name!=="order_created" || order?.type!=="orders")return false;
  if(!order.id || !attr || !storeId || !variantId)return false;
  if(String(attr.store_id)!==String(storeId) || String(attr.first_order_item?.variant_id||attr.variant_id)!==String(variantId))return false;
  if(attr.status!=="paid" || !(Number(attr.total)>0))return false;
  if(payload?.meta?.test_mode===true && !allowTest)return false;
  if(attr.test_mode===true && !allowTest)return false;
  if(!/^[a-zA-Z0-9_-]{10,96}$/.test(String(meta?.custom_data?.kivzuno_order||"")))return false;
  return true;
}
export function checkoutPayload({storeId,variantId,orderRef,returnUrl}) {
  if(!/^\d+$/.test(String(storeId)) || !/^\d+$/.test(String(variantId)) ||
    !/^[a-zA-Z0-9_-]{10,96}$/.test(String(orderRef)) ||
    typeof returnUrl!=="string" || !returnUrl.startsWith("https://"))throw new Error("checkout_config");
  return {
    data:{
      type:"checkouts",
      attributes:{
        checkout_options:{embed:false},
        checkout_data:{custom:{kivzuno_order:orderRef}},
        product_options:{redirect_url:returnUrl,enabled_variants:[Number(variantId)]},
        expires_at:new Date(Date.now()+30*60*1000).toISOString()
      },
      relationships:{
        store:{data:{type:"stores",id:String(storeId)}},
        variant:{data:{type:"variants",id:String(variantId)}}
      }
    }
  };
}
