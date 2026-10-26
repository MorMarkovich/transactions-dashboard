import express from 'express'
// Local sync requests are tiny uncompressed JSON. Do not decompress untrusted
// bodies before route authentication. Unsupported encodings fail with415.
export const syncJsonParser = () => express.json({limit:'256kb',inflate:false})

// Terminal Express boundary, registered after routes. Never pass arbitrary
// parser messages/stacks to Express's development default error handler.
export function safeRequestError(error,req,res,next){
 let status=400
 try{if(error?.type==='entity.too.large')status=413;else if(error?.type==='encoding.unsupported')status=415}catch{/* hostile error shape */}
 console.error('BANK_REQUEST_REJECTED')
 res.status(status).json({success:false,error:'BANK_REQUEST_REJECTED'})
}
